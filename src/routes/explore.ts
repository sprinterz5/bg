import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const exploreQuerySchema = z.object({
  filter: z.enum(["all", "articles", "books"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

function interestBoost(tags: string[], interests: string[]) {
  const normalized = new Set(interests.map((interest) => interest.toLowerCase()));
  return tags.reduce((score, tag) => score + (normalized.has(tag.toLowerCase()) ? 3 : 0), 0);
}

export const exploreRoutes: FastifyPluginAsync = async (app) => {
  app.get("/explore", { preHandler: [app.authenticate] }, async (request) => {
    const query = exploreQuerySchema.parse(request.query);
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } });
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
      take: query.limit * 3
    });

    const articleIds = exploreItems.filter((item) => item.targetType === "ARTICLE").map((item) => item.targetId);
    const reviewIds = exploreItems.filter((item) => item.targetType === "REVIEW").map((item) => item.targetId);

    const [articles, reviews] = await Promise.all([
      app.prisma.article.findMany({
        where: {
          id: { in: articleIds },
          status: "PUBLISHED",
          moderationStatus: "APPROVED",
          deletedAt: null
        },
        include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
      }),
      app.prisma.review.findMany({
        where: {
          id: { in: reviewIds },
          status: "PUBLISHED",
          moderationStatus: "APPROVED",
          deletedAt: null
        },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          book: true
        }
      })
    ]);

    const articleMap = new Map(articles.map((article) => [article.id, article]));
    const reviewMap = new Map(reviews.map((review) => [review.id, review]));

    const data = exploreItems
      .map((item) => {
        if (item.targetType === "ARTICLE") {
          const article = articleMap.get(item.targetId);
          return article
            ? {
                id: item.id,
                targetType: "ARTICLE",
                score: item.score + interestBoost(article.tags, user.interests),
                content: article
              }
            : null;
        }

        const review = reviewMap.get(item.targetId);
        return review
          ? {
              id: item.id,
              targetType: "REVIEW",
              score: item.score + interestBoost([...review.tags, ...review.book.categories], user.interests),
              content: review
            }
          : null;
      })
      .filter((item) => item !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit);

    return { data };
  });
};
