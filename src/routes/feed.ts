import type { Article, Book, Review, User } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const feedQuerySchema = z.object({
  mode: z.enum(["for_you", "following"]).default("for_you"),
  filter: z.enum(["all", "articles", "books"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.coerce.date().optional()
});

type FeedAuthor = Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
type ArticleWithAuthor = Article & { author: FeedAuthor };
type ReviewWithAuthorBook = Review & { author: FeedAuthor; book: Book };

function tagsScore(tags: string[], interests: string[]) {
  const interestSet = new Set(interests.map((interest) => interest.toLowerCase()));
  return tags.reduce((score, tag) => score + (interestSet.has(tag.toLowerCase()) ? 2 : 0), 0);
}

function recencyScore(date: Date | null) {
  if (!date) {
    return 0;
  }
  const ageHours = Math.max(1, (Date.now() - date.getTime()) / 36e5);
  return Math.min(5, 24 / ageHours);
}

function articleItem(article: ArticleWithAuthor, followingIds: Set<string>, interests: string[]) {
  const publishedAt = article.publishedAt ?? article.createdAt;
  return {
    id: `article:${article.id}`,
    targetType: "ARTICLE" as const,
    targetId: article.id,
    title: article.title,
    excerpt: article.excerpt,
    coverImageUrl: article.coverImageUrl,
    tags: article.tags,
    author: article.author,
    publishedAt,
    readingTimeMinutes: article.readingTimeMinutes,
    score: (followingIds.has(article.authorId) ? 100 : 0) + tagsScore(article.tags, interests) + recencyScore(publishedAt)
  };
}

function reviewItem(review: ReviewWithAuthorBook, followingIds: Set<string>, interests: string[]) {
  const publishedAt = review.publishedAt ?? review.createdAt;
  return {
    id: `review:${review.id}`,
    targetType: "REVIEW" as const,
    targetId: review.id,
    title: review.title,
    excerpt: review.body.slice(0, 280),
    rating: review.rating,
    tags: review.tags,
    author: review.author,
    book: review.book,
    publishedAt,
    readingTimeMinutes: review.readingTimeMinutes,
    score:
      (followingIds.has(review.authorId) ? 100 : 0) +
      tagsScore([...review.tags, ...review.book.categories], interests) +
      recencyScore(publishedAt)
  };
}

export const feedRoutes: FastifyPluginAsync = async (app) => {
  app.get("/feed", { preHandler: [app.authenticate] }, async (request) => {
    const query = feedQuerySchema.parse(request.query);
    const cacheKey = `feed:${request.user.sub}:${query.mode}:${query.filter}:${query.limit}:${query.before?.toISOString() ?? "now"}`;
    const cached = await app.redis.get(cacheKey).catch(() => null);
    if (cached) {
      return JSON.parse(cached);
    }

    const [user, follows] = await Promise.all([
      app.prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } }),
      app.prisma.follow.findMany({
        where: { followerId: request.user.sub },
        select: { followingId: true }
      })
    ]);

    const followingIds = new Set(follows.map((follow) => follow.followingId));
    const beforeFilter = query.before ? { lt: query.before } : undefined;
    const authorFilter = query.mode === "following" ? { in: [...followingIds] } : undefined;

    const [articles, reviews] = await Promise.all([
      query.filter === "books"
        ? Promise.resolve([])
        : app.prisma.article.findMany({
            where: {
              status: "PUBLISHED",
              moderationStatus: "APPROVED",
              deletedAt: null,
              ...(authorFilter ? { authorId: authorFilter } : {}),
              ...(beforeFilter ? { publishedAt: beforeFilter } : {})
            },
            take: query.limit * 2,
            orderBy: { publishedAt: "desc" },
            include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
          }),
      query.filter === "articles"
        ? Promise.resolve([])
        : app.prisma.review.findMany({
            where: {
              status: "PUBLISHED",
              moderationStatus: "APPROVED",
              deletedAt: null,
              ...(authorFilter ? { authorId: authorFilter } : {}),
              ...(beforeFilter ? { publishedAt: beforeFilter } : {})
            },
            take: query.limit * 2,
            orderBy: { publishedAt: "desc" },
            include: {
              author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
              book: true
            }
          })
    ]);

    const items = [
      ...articles.map((article) => articleItem(article, followingIds, user.interests)),
      ...reviews.map((review) => reviewItem(review, followingIds, user.interests))
    ];

    const sorted =
      query.mode === "following"
        ? items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        : items.sort((a, b) => b.score - a.score || b.publishedAt.getTime() - a.publishedAt.getTime());

    const data = sorted.slice(0, query.limit);
    const result = {
      data,
      nextCursor: data.at(-1)?.publishedAt.toISOString() ?? null,
      algorithm: query.mode === "for_you" ? "friends_first_interest_recency_v1" : "following_recency_v1"
    };

    await app.redis.set(cacheKey, JSON.stringify(result), "EX", 60).catch(() => undefined);
    return result;
  });
};
