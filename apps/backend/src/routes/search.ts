import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { QUALITY_PRIOR } from "../services/contentScoreService.js";
import { getBlockedIds } from "../services/blockService.js";
import { endpointRateLimit } from "../services/rateLimitService.js";
import { fuzzyArticleIds, fuzzyBookIds, fuzzyReviewIds, fuzzyUserIds } from "../services/searchPlanner.js";
import { asApi, type ApiUserSearch } from "../contracts/api.js";

const searchQuerySchema = z.object({
  q: z.string().min(1).max(120),
  type: z.enum(["all", "users", "books", "articles", "reviews"]).default("all"),
  limit: z.coerce.number().int().min(1).max(25).default(10)
});

export const searchRoutes: FastifyPluginAsync = async (app) => {
  app.get("/search", { preHandler: [app.authenticate, endpointRateLimit({ key: "search", limit: 120, windowSeconds: 60, by: "userOrIp" })] }, async (request) => {
    const query = searchQuerySchema.parse(request.query);
    const q = query.q.trim();
    const qLower = q.toLowerCase();
    const include = (type: typeof query.type) => query.type === "all" || query.type === type;
    const blockedIds = await getBlockedIds(app, request.user.sub);
    const mutedRows = await app.prisma.userMute.findMany({
      where: { muterId: request.user.sub },
      select: { mutedId: true }
    });
    const hiddenAuthorIds = [...blockedIds, ...mutedRows.map((row) => row.mutedId)];

    const textScore = (...values: Array<string | null | undefined>) => {
      return values.reduce((score, value) => {
        const normalized = value?.toLowerCase();
        if (!normalized) {
          return score;
        }
        if (normalized === qLower) {
          return score + 100;
        }
        if (normalized.startsWith(qLower)) {
          return score + 65;
        }
        if (normalized.includes(qLower)) {
          return score + 30;
        }
        return score;
      }, 0);
    };

    // Matching happens in the trigram queries (searchPlanner: substring + similarity on the indexed expressions);
    // the rows are then loaded by id. Matching again here with `contains` (ILIKE on each column, the whole article
    // body included) could use no index and scanned every table on each keystroke. Under 3 characters trigrams
    // don't work: a title / name prefix instead.
    const short = q.length < 3;
    const fuzzyLimit = query.limit * 4;
    const [fuzzyUsers, fuzzyBooks, fuzzyArticles, fuzzyReviews] = await Promise.all([
      include("users") ? fuzzyUserIds(app.prisma, q, fuzzyLimit, hiddenAuthorIds) : Promise.resolve([]),
      include("books") ? fuzzyBookIds(app.prisma, q, fuzzyLimit) : Promise.resolve([]),
      include("articles") ? fuzzyArticleIds(app.prisma, q, fuzzyLimit, hiddenAuthorIds) : Promise.resolve([]),
      include("reviews") ? fuzzyReviewIds(app.prisma, q, fuzzyLimit, hiddenAuthorIds) : Promise.resolve([])
    ]);

    const [users, books, articles, reviews] = await Promise.all([
      include("users")
        ? app.prisma.user.findMany({
            where: {
              deletedAt: null,
              id: short ? { notIn: hiddenAuthorIds } : { in: fuzzyUsers, notIn: hiddenAuthorIds },
              ...(short ? { OR: [{ username: { startsWith: q, mode: "insensitive" } }, { displayName: { startsWith: q, mode: "insensitive" } }] } : {})
            },
            take: query.limit * 4,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              username: true,
              displayName: true,
              bio: true,
              avatarUrl: true,
              interests: true
            }
          })
        : Promise.resolve([]),
      include("books")
        ? app.prisma.book.findMany({
            where: {
              ...(short ? { title: { startsWith: q, mode: "insensitive" } } : { id: { in: fuzzyBooks } })
            },
            take: query.limit * 4,
            orderBy: { updatedAt: "desc" }
          })
        : Promise.resolve([]),
      include("articles")
        ? app.prisma.article.findMany({
            where: {
              status: "PUBLISHED",
              moderationStatus: "APPROVED",
              deletedAt: null,
              ...(hiddenAuthorIds.length > 0 ? { authorId: { notIn: hiddenAuthorIds } } : {}),
              ...(short ? { title: { startsWith: q, mode: "insensitive" } } : { id: { in: fuzzyArticles } })
            },
            take: query.limit * 4,
            orderBy: { publishedAt: "desc" },
            include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
          })
        : Promise.resolve([]),
      include("reviews")
        ? app.prisma.review.findMany({
            where: {
              status: "PUBLISHED",
              moderationStatus: "APPROVED",
              deletedAt: null,
              ...(hiddenAuthorIds.length > 0 ? { authorId: { notIn: hiddenAuthorIds } } : {}),
              ...(short ? { title: { startsWith: q, mode: "insensitive" } } : { id: { in: fuzzyReviews } })
            },
            take: query.limit * 4,
            orderBy: { publishedAt: "desc" },
            include: {
              author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
              book: true
            }
          })
        : Promise.resolve([])
    ]);

    const contentScores = await app.prisma.contentScore.findMany({
      where: {
        OR: [
          ...articles.map((article) => ({ targetType: "ARTICLE" as const, targetId: article.id })),
          ...reviews.map((review) => ({ targetType: "REVIEW" as const, targetId: review.id }))
        ]
      }
    });
    const scoreMap = new Map(contentScores.map((score) => [`${score.targetType}:${score.targetId}`, score]));

    const rankedUsers = users
      .map((user) => ({
        ...user,
        searchScore: textScore(user.username, user.displayName, user.bio) + user.interests.reduce((score, tag) => score + textScore(tag), 0)
      }))
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, query.limit);

    const rankedBooks = books
      .map((book) => ({
        ...book,
        searchScore:
          textScore(book.title, book.subtitle, book.isbn10, book.isbn13, book.publisher) +
          book.authors.reduce((score, author) => score + textScore(author), 0) +
          book.categories.reduce((score, category) => score + textScore(category), 0)
      }))
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, query.limit);

    const rankedArticles = articles
      .map((article) => {
        const stats = scoreMap.get(`ARTICLE:${article.id}`);
        return {
          ...article,
          searchScore:
            textScore(article.title, article.subtitle, article.excerpt, article.body) +
            article.tags.reduce((score, tag) => score + textScore(tag), 0) +
            (stats?.qualityScore ?? QUALITY_PRIOR) * 0.15 +
            (stats?.trendingScore ?? 0) * 0.2 -
            (stats?.spamScore ?? 0) * 0.4
        };
      })
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, query.limit);

    const rankedReviews = reviews
      .map((review) => {
        const stats = scoreMap.get(`REVIEW:${review.id}`);
        return {
          ...review,
          searchScore:
            textScore(review.title, review.body, review.book.title, review.book.subtitle) +
            review.tags.reduce((score, tag) => score + textScore(tag), 0) +
            review.book.authors.reduce((score, author) => score + textScore(author), 0) +
            review.book.categories.reduce((score, category) => score + textScore(category), 0) +
            (stats?.qualityScore ?? QUALITY_PRIOR) * 0.15 +
            (stats?.trendingScore ?? 0) * 0.2 -
            (stats?.spamScore ?? 0) * 0.4
        };
      })
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, query.limit);

    const body = {
      query: q,
      algorithm: "trigram_text_relevance_quality_v2",
      data: {
        users: rankedUsers,
        books: rankedBooks,
        articles: rankedArticles,
        reviews: rankedReviews
      }
    };
    return asApi<ApiUserSearch>(body);
  });
};
