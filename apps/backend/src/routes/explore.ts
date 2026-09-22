import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getBlockedIds } from "../services/blockService.js";

const exploreQuerySchema = z.object({
  filter: z.enum(["all", "articles", "books"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

function interestBoost(tags: string[], interests: string[]) {
  const normalized = new Set(interests.map((interest) => interest.toLowerCase()));
  return tags.reduce((score, tag) => score + (normalized.has(tag.toLowerCase()) ? 3 : 0), 0);
}

function freshnessBoost(publishedAt: Date | null) {
  if (!publishedAt) {
    return 0;
  }
  const ageHours = Math.max((Date.now() - publishedAt.getTime()) / 36e5, 0);
  return Math.max(0, 18 - ageHours * 0.25);
}

export const exploreRoutes: FastifyPluginAsync = async (app) => {
  app.get("/explore", { preHandler: [app.authenticate] }, async (request) => {
    const query = exploreQuerySchema.parse(request.query);
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } });
    const blockedIds = await getBlockedIds(app, request.user.sub);
    const mutedRows = await app.prisma.userMute.findMany({
      where: { muterId: request.user.sub },
      select: { mutedId: true }
    });
    const hiddenAuthorIds = [...blockedIds, ...mutedRows.map((row) => row.mutedId)];
    const targetTypes =
      query.filter === "articles"
        ? ["ARTICLE" as const]
        : query.filter === "books"
          ? ["REVIEW" as const]
          : ["ARTICLE" as const, "REVIEW" as const];

    const exploreItems = await app.prisma.exploreItem.findMany({
      where: {
        moderationStatus: "APPROVED",
        targetType: { in: targetTypes }
      },
      orderBy: { score: "desc" },
      take: query.limit * 5
    });

    const articleIds = exploreItems.filter((item) => item.targetType === "ARTICLE").map((item) => item.targetId);
    const reviewIds = exploreItems.filter((item) => item.targetType === "REVIEW").map((item) => item.targetId);

    const [articles, reviews] = await Promise.all([
      app.prisma.article.findMany({
        where: {
          id: { in: articleIds },
          status: "PUBLISHED",
          moderationStatus: "APPROVED",
          deletedAt: null,
          ...(hiddenAuthorIds.length > 0 ? { authorId: { notIn: hiddenAuthorIds } } : {})
        },
        include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
      }),
      app.prisma.review.findMany({
        where: {
          id: { in: reviewIds },
          status: "PUBLISHED",
          moderationStatus: "APPROVED",
          deletedAt: null,
          ...(hiddenAuthorIds.length > 0 ? { authorId: { notIn: hiddenAuthorIds } } : {})
        },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          book: true
        }
      })
    ]);

    const articleMap = new Map(articles.map((article) => [article.id, article]));
    const reviewMap = new Map(reviews.map((review) => [review.id, review]));
    const contentScores = await app.prisma.contentScore.findMany({
      where: {
        OR: [
          ...articleIds.map((id) => ({ targetType: "ARTICLE" as const, targetId: id })),
          ...reviewIds.map((id) => ({ targetType: "REVIEW" as const, targetId: id }))
        ]
      }
    });
    const scoreMap = new Map(contentScores.map((score) => [`${score.targetType}:${score.targetId}`, score]));
    const seenAuthors = new Set<string>();

    const data = exploreItems
      .map((item) => {
        if (item.targetType === "ARTICLE") {
          const article = articleMap.get(item.targetId);
          return article
            ? {
                id: item.id,
                targetType: "ARTICLE",
                score:
                  item.score +
                  interestBoost(article.tags, user.interests) +
                  freshnessBoost(article.publishedAt) +
                  (scoreMap.get(`ARTICLE:${article.id}`)?.qualityScore ?? 0) * 0.3 +
                  (scoreMap.get(`ARTICLE:${article.id}`)?.trendingScore ?? 0) * 0.45 -
                  (scoreMap.get(`ARTICLE:${article.id}`)?.spamScore ?? 0) * 0.7,
                content: article
              }
            : null;
        }

        const review = reviewMap.get(item.targetId);
        return review
          ? {
              id: item.id,
              targetType: "REVIEW",
              score:
                item.score +
                interestBoost([...review.tags, ...review.book.categories], user.interests) +
                freshnessBoost(review.publishedAt) +
                (scoreMap.get(`REVIEW:${review.id}`)?.qualityScore ?? 0) * 0.3 +
                (scoreMap.get(`REVIEW:${review.id}`)?.trendingScore ?? 0) * 0.45 -
                (scoreMap.get(`REVIEW:${review.id}`)?.spamScore ?? 0) * 0.7,
              content: review
            }
          : null;
      })
      .filter((item) => item !== null)
      .sort((a, b) => b.score - a.score)
      .filter((item) => {
        const authorId = item.targetType === "ARTICLE" ? item.content.authorId : item.content.authorId;
        if (seenAuthors.has(authorId) && seenAuthors.size < query.limit) {
          item.score -= 12;
        }
        seenAuthors.add(authorId);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit);

    return { data, algorithm: "moderated_quality_trending_diversity_v1" };
  });
};
