import type { Article, Book, Review, User } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getBlockedIds } from "../services/blockService.js";
import { needsColdStart, getColdStartFeed } from "../services/coldStartService.js";
import { scoreFeedItems } from "../services/feedAlgorithm.js";
import { enrichFeedItems } from "../services/feedPresentationService.js";

const feedQuerySchema = z.object({
  mode: z.enum(["for_you", "following"]).default("for_you"),
  filter: z.enum(["all", "articles", "books"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.coerce.date().optional()
});

type FeedAuthor = Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
type ArticleWithAuthor = Article & { author: FeedAuthor };
type ReviewWithAuthorBook = Review & { author: FeedAuthor; book: Book };

function articleToFeedItem(article: ArticleWithAuthor) {
  const publishedAt = article.publishedAt ?? article.createdAt;
  return {
    id: `article:${article.id}`,
    targetType: "ARTICLE" as const,
    targetId: article.id,
    authorId: article.authorId,
    title: article.title,
    excerpt: article.excerpt,
    coverImageUrl: article.coverImageUrl,
    tags: article.tags,
    categories: [] as string[],
    author: article.author,
    publishedAt,
    readingTimeMinutes: article.readingTimeMinutes
  };
}

function reviewToFeedItem(review: ReviewWithAuthorBook) {
  const publishedAt = review.publishedAt ?? review.createdAt;
  return {
    id: `review:${review.id}`,
    targetType: "REVIEW" as const,
    targetId: review.id,
    authorId: review.authorId,
    title: review.title,
    excerpt: review.body.slice(0, 280),
    rating: review.rating,
    tags: review.tags,
    categories: review.book.categories,
    author: review.author,
    book: review.book,
    publishedAt,
    readingTimeMinutes: review.readingTimeMinutes
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

    const followingIds = new Set(follows.map((f) => f.followingId));
    const blockedIds = await getBlockedIds(app, request.user.sub);
    const mutedRows = await app.prisma.userMute.findMany({
      where: { muterId: request.user.sub },
      select: { mutedId: true }
    });
    const mutedIds = new Set(mutedRows.map((m) => m.mutedId));

    if (query.mode === "for_you" && await needsColdStart(app, request.user.sub)) {
      const coldItems = await getColdStartFeed(app, request.user.sub, user.interests, query.limit);
      const data = await enrichFeedItems(app, request.user.sub, coldItems.slice(0, query.limit));
      const result = {
        data,
        nextCursor: null,
        algorithm: "cold_start_v1"
      };
      await app.redis.set(cacheKey, JSON.stringify(result), "EX", 60).catch(() => undefined);
      return result;
    }

    const beforeFilter = query.before ? { lt: query.before } : undefined;
    const excludeAuthors = [...blockedIds, ...mutedIds];
    const authorConstraints = [
      ...(query.mode === "following" ? [{ authorId: { in: [...followingIds] } }] : []),
      ...(excludeAuthors.length > 0 ? [{ authorId: { notIn: excludeAuthors } }] : [])
    ];

    const [articles, reviews] = await Promise.all([
      query.filter === "books"
        ? Promise.resolve([])
        : app.prisma.article.findMany({
            where: {
              status: "PUBLISHED",
              moderationStatus: "APPROVED",
              deletedAt: null,
              ...(authorConstraints.length > 0 ? { AND: authorConstraints } : {}),
              ...(beforeFilter ? { publishedAt: beforeFilter } : {})
            },
            take: query.limit * 3,
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
              ...(authorConstraints.length > 0 ? { AND: authorConstraints } : {}),
              ...(beforeFilter ? { publishedAt: beforeFilter } : {})
            },
            take: query.limit * 3,
            orderBy: { publishedAt: "desc" },
            include: {
              author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
              book: true
            }
          })
    ]);

    const items = [
      ...articles.map((a) => articleToFeedItem(a)),
      ...reviews.map((r) => reviewToFeedItem(r))
    ];

    let data;
    let algorithm: string;

    if (query.mode === "following") {
      data = items
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, query.limit);
      algorithm = "following_recency_v1";
    } else {
      const scored = await scoreFeedItems(app, request.user.sub, items, followingIds, user.interests, mutedIds, blockedIds);
      data = scored.slice(0, query.limit);
      algorithm = "behavioral_ranking_v2";
    }

    const result = {
      data: await enrichFeedItems(app, request.user.sub, data),
      nextCursor: data.at(-1)?.publishedAt.toISOString() ?? null,
      algorithm
    };

    await app.redis.set(cacheKey, JSON.stringify(result), "EX", 60).catch(() => undefined);
    return result;
  });
};
