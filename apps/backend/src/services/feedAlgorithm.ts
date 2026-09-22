import type { FastifyInstance } from "fastify";

type FeedItem = {
  targetType: "ARTICLE" | "REVIEW";
  targetId: string;
  authorId: string;
  tags: string[];
  categories: string[];
  publishedAt: Date;
};

function normalize(values: string[]) {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function interestScore(item: FeedItem, interests: string[]) {
  const normalizedInterests = normalize(interests);
  if (normalizedInterests.size === 0) {
    return 0;
  }

  return [...normalize([...item.tags, ...item.categories])].reduce(
    (score, value) => score + (normalizedInterests.has(value) ? 12 : 0),
    0
  );
}

function recencyScore(publishedAt: Date) {
  const ageHours = Math.max((Date.now() - publishedAt.getTime()) / 36e5, 0);
  return Math.max(0, 30 - ageHours * 0.6);
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
      const score =
        socialBoost +
        interestScore(item, interests) +
        recencyScore(item.publishedAt) +
        (stats?.qualityScore ?? 0) * 0.22 +
        (stats?.trendingScore ?? 0) * 0.35 -
        (stats?.spamScore ?? 0) * 0.5 +
        behavioralBoost;

      return {
        ...item,
        score,
        scoreBreakdown: {
          socialBoost,
          interestBoost: interestScore(item, interests),
          recencyBoost: recencyScore(item.publishedAt),
          qualityScore: stats?.qualityScore ?? 0,
          trendingScore: stats?.trendingScore ?? 0,
          spamPenalty: stats?.spamScore ?? 0
        }
      };
    })
    .sort((a, b) => b.score - a.score);
}
