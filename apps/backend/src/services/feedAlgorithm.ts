import type { FastifyInstance } from "fastify";
import { QUALITY_PRIOR } from "./contentScoreService.js";

type FeedItem = {
  targetType: "ARTICLE" | "REVIEW";
  targetId: string;
  authorId: string;
  tags: string[];
  categories: string[];
  publishedAt: Date;
};

// "#Machine-Learning", "machine learning" and "machine_learning" are one interest; a trailing plural "s" too.
function canonical(value: string) {
  const v = value.trim().toLowerCase().replace(/^#/, "").replace(/[\s_-]+/g, " ").trim();
  return v.length > 3 && v.endsWith("s") && !v.endsWith("ss") ? v.slice(0, -1) : v;
}

function normalize(values: string[]) {
  return new Set(values.map(canonical).filter(Boolean));
}

// 12 per tag that matches an interest; 6 when one only contains the other ("ai" never counts that way:
// both sides need 4+ letters), e.g. "startup" ~ "startup funding".
export function interestScore(item: Pick<FeedItem, "tags" | "categories">, interests: string[]) {
  const normalizedInterests = normalize(interests);
  if (normalizedInterests.size === 0) {
    return 0;
  }

  return [...normalize([...item.tags, ...item.categories])].reduce((score, value) => {
    if (normalizedInterests.has(value)) return score + 12;
    if (value.length < 4) return score;
    for (const interest of normalizedInterests) {
      if (interest.length >= 4 && (value.includes(interest) || interest.includes(value))) return score + 6;
    }
    return score;
  }, 0);
}

function ageHours(publishedAt: Date) {
  return Math.max((Date.now() - publishedAt.getTime()) / 36e5, 0);
}

// Freshness halves every day instead of dropping to zero at 50 h: a two-day-old post still gets a little.
const RECENCY_MAX = 30;
const RECENCY_HALF_LIFE_H = 24;
// trendingScore only grows with lifetime totals, so it fades with the post's age: an old viral post stops
// outranking this week's ones, but a strong one can still surface (half-life 3 days).
const TRENDING_HALF_LIFE_H = 72;
// Each further post of the same author higher up in the list costs this much: one author can't fill the feed.
const AUTHOR_REPEAT_PENALTY = 14;

function recencyScore(publishedAt: Date) {
  return RECENCY_MAX * 0.5 ** (ageHours(publishedAt) / RECENCY_HALF_LIFE_H);
}

function trendingWeight(publishedAt: Date) {
  return 0.5 ** (ageHours(publishedAt) / TRENDING_HALF_LIFE_H);
}

/** Re-ranks a score-sorted list so the same author's posts are spread out. */
export function diversifyByAuthor<T extends { authorId: string; score: number }>(items: T[]) {
  const seen = new Map<string, number>();
  return items
    .map((item) => {
      const repeats = seen.get(item.authorId) ?? 0;
      seen.set(item.authorId, repeats + 1);
      return { item, adjusted: item.score - repeats * AUTHOR_REPEAT_PENALTY };
    })
    .sort((a, b) => b.adjusted - a.adjusted)
    .map(({ item }) => item);
}

export async function scoreFeedItems<T extends FeedItem>(
  app: FastifyInstance,
  userId: string,
  items: T[],
  followingIds: Set<string>,
  interests: string[],
  mutedIds: Set<string>,
  blockedIds: Set<string>
) {
  const visibleItems = items.filter((item) => !mutedIds.has(item.authorId) && !blockedIds.has(item.authorId));
  const targetPairs = visibleItems.map((item) => ({
    targetType: item.targetType,
    targetId: item.targetId
  }));

  const [scores, userEvents] = await Promise.all([
    targetPairs.length === 0
      ? Promise.resolve([])
      : app.prisma.contentScore.findMany({
          where: {
            OR: targetPairs
          }
        }),
    app.prisma.feedEvent.findMany({
      where: {
        userId,
        eventType: { in: ["OPEN", "LIKE", "SAVE", "BOOKMARK", "COMMENT", "SHARE"] }
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { targetType: true, targetId: true }
    })
  ]);

  const scoreMap = new Map(scores.map((score) => [`${score.targetType}:${score.targetId}`, score]));
  const touchedTargetIds = new Set(userEvents.map((event) => `${event.targetType}:${event.targetId}`));

  return visibleItems
    .map((item) => {
      const stats = scoreMap.get(`${item.targetType}:${item.targetId}`);
      const socialBoost = followingIds.has(item.authorId) ? 28 : 0;
      const behavioralBoost = touchedTargetIds.has(`${item.targetType}:${item.targetId}`) ? -20 : 0;
      const trending = (stats?.trendingScore ?? 0) * trendingWeight(item.publishedAt);
      const score =
        socialBoost +
        interestScore(item, interests) +
        recencyScore(item.publishedAt) +
        (stats?.qualityScore ?? QUALITY_PRIOR) * 0.22 +
        trending * 0.35 -
        (stats?.spamScore ?? 0) * 0.5 +
        behavioralBoost;

      return {
        ...item,
        score,
        scoreBreakdown: {
          socialBoost,
          interestBoost: interestScore(item, interests),
          recencyBoost: recencyScore(item.publishedAt),
          qualityScore: stats?.qualityScore ?? QUALITY_PRIOR,
          trendingScore: trending,
          spamPenalty: stats?.spamScore ?? 0
        }
      };
    })
    .sort((a, b) => b.score - a.score);
}
