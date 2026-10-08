import { randomUUID } from "node:crypto";
import type { Article, Book, Prisma, Review, User } from "@prisma/client";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getBlockedIds } from "../services/blockService.js";
import { needsColdStart, getColdStartFeed } from "../services/coldStartService.js";
import { diversifyByAuthor, scoreFeedItems } from "../services/feedAlgorithm.js";
import { enrichFeedItems } from "../services/feedPresentationService.js";

const feedQuerySchema = z.object({
  mode: z.enum(["for_you", "following"]).default("for_you"),
  filter: z.enum(["all", "articles", "books"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** following: publishedAt of the last item; for_you uses `cursor`. */
  before: z.coerce.date().optional(),
  /** for_you: opaque nextCursor from the previous page. */
  cursor: z.string().max(100).optional()
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

const authorSelect = { select: { id: true, username: true, displayName: true, avatarUrl: true } } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

// for_you ranks a pool of candidates once and keeps the ranked ids for a while; later pages are slices of that
// list (cursor = snapshot id + offset). Paging by publishedAt lost posts: the order is by score, not by date.
// The feed doesn't end with the first pool: when a page runs past the list, the next older batch of posts
// (before `frontier`, the oldest point the newest-first source reached) is ranked and appended.
const SNAPSHOT_TTL_SECONDS = 30 * 60;
const SNAPSHOT_MAX = 20_000;
const FRESH_TAKE = 150;
const SOURCE_TAKE = 100;

type FeedFilter = "all" | "articles" | "books";
type CandidateContext = { userId: string; filter: FeedFilter; hiddenAuthorIds: string[]; interests: string[] };
type Snapshot = { keys: string[]; frontier: string | null };

function visibleWhere(hiddenAuthorIds: string[]) {
  return {
    status: "PUBLISHED" as const,
    moderationStatus: "APPROVED" as const,
    deletedAt: null,
    ...(hiddenAuthorIds.length > 0 ? { authorId: { notIn: hiddenAuthorIds } } : {})
  };
}

/**
 * Candidate pool from several sources: newest, followed authors, trending this week, matching interests.
 * With `before` (extending a snapshot) only the newest-first source, older than that point.
 * `frontier` = where the newest-first source stopped (null when it ran out of posts).
 */
async function loadCandidates(app: FastifyInstance, ctx: CandidateContext, before?: Date) {
  const base = visibleWhere(ctx.hiddenAuthorIds);
  const fresh = before ? { ...base, publishedAt: { lt: before } } : base;
  const since = (days: number) => ({ gte: new Date(Date.now() - days * DAY_MS) });
  const followed = { author: { followers: { some: { followerId: ctx.userId } } } };
  const interests = [...new Set(ctx.interests.flatMap((i) => [i, i.toLowerCase()]))];

  const articleSources: Prisma.ArticleWhereInput[] = before
    ? [fresh]
    : [
        fresh,
        { ...base, ...followed, publishedAt: since(14) },
        ...(interests.length > 0 ? [{ ...base, tags: { hasSome: interests }, publishedAt: since(30) }] : [])
      ];
  const reviewSources: Prisma.ReviewWhereInput[] = before
    ? [fresh]
    : [
        fresh,
        { ...base, ...followed, publishedAt: since(14) },
        ...(interests.length > 0
          ? [{ ...base, publishedAt: since(30), OR: [{ tags: { hasSome: interests } }, { book: { categories: { hasSome: interests } } }] }]
          : [])
      ];

  const trendingIds = async (targetType: "ARTICLE" | "REVIEW") =>
    before
      ? []
      : (
          await app.prisma.contentScore.findMany({
            where: { targetType, trendingScore: { gt: 0 }, updatedAt: since(7) },
            orderBy: { trendingScore: "desc" },
            take: SOURCE_TAKE,
            select: { targetId: true }
          })
        ).map((row) => row.targetId);

  const [articleLists, reviewLists] = await Promise.all([
    ctx.filter === "books"
      ? Promise.resolve([])
      : Promise.all([
          ...articleSources.map((where, i) =>
            app.prisma.article.findMany({ where, take: i === 0 ? FRESH_TAKE : SOURCE_TAKE, orderBy: { publishedAt: "desc" }, include: { author: authorSelect } })
          ),
          trendingIds("ARTICLE").then((ids) =>
            ids.length === 0 ? [] : app.prisma.article.findMany({ where: { ...base, id: { in: ids } }, include: { author: authorSelect } })
          )
        ]),
    ctx.filter === "articles"
      ? Promise.resolve([])
      : Promise.all([
          ...reviewSources.map((where, i) =>
            app.prisma.review.findMany({ where, take: i === 0 ? FRESH_TAKE : SOURCE_TAKE, orderBy: { publishedAt: "desc" }, include: { author: authorSelect, book: true } })
          ),
          trendingIds("REVIEW").then((ids) =>
            ids.length === 0 ? [] : app.prisma.review.findMany({ where: { ...base, id: { in: ids } }, include: { author: authorSelect, book: true } })
          )
        ])
  ]);

  const unique = new Map<string, ReturnType<typeof articleToFeedItem> | ReturnType<typeof reviewToFeedItem>>();
  for (const article of articleLists.flat()) unique.set(`ARTICLE:${article.id}`, articleToFeedItem(article));
  for (const review of reviewLists.flat()) unique.set(`REVIEW:${review.id}`, reviewToFeedItem(review));

  // The newest-first lists are the first of each; a full one may have more behind its last post. The later of
  // the two stopping points: older posts of the other type not reached yet come next time (seen ones are skipped).
  const stops = [articleLists[0], reviewLists[0]]
    .filter((list) => list && list.length === FRESH_TAKE)
    .map((list) => {
      const last = list!.at(-1)!;
      return (last.publishedAt ?? last.createdAt).getTime();
    });
  const frontier = stops.length > 0 ? new Date(Math.max(...stops)).toISOString() : null;
  return { items: [...unique.values()], frontier };
}

/** Items of a snapshot page, in snapshot order; posts deleted or hidden since are skipped. */
async function loadItemsByKeys(app: FastifyInstance, keys: string[]) {
  const ids = (prefix: string) => keys.filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
  const articleIds = ids("ARTICLE:");
  const reviewIds = ids("REVIEW:");
  const base = visibleWhere([]);
  const [articles, reviews] = await Promise.all([
    articleIds.length === 0 ? [] : app.prisma.article.findMany({ where: { ...base, id: { in: articleIds } }, include: { author: authorSelect } }),
    reviewIds.length === 0 ? [] : app.prisma.review.findMany({ where: { ...base, id: { in: reviewIds } }, include: { author: authorSelect, book: true } })
  ]);
  const byKey = new Map<string, ReturnType<typeof articleToFeedItem> | ReturnType<typeof reviewToFeedItem>>([
    ...articles.map((a) => [`ARTICLE:${a.id}`, articleToFeedItem(a)] as const),
    ...reviews.map((r) => [`REVIEW:${r.id}`, reviewToFeedItem(r)] as const)
  ]);
  return keys.flatMap((key) => byKey.get(key) ?? []);
}

function parseCursor(cursor: string | undefined) {
  const match = cursor?.match(/^([0-9a-f-]{36})\.(\d{1,5})$/);
  return match?.[1] && match[2] ? { snapshotId: match[1], offset: Number(match[2]) } : null;
}

export const feedRoutes: FastifyPluginAsync = async (app) => {
  app.get("/feed", { preHandler: [app.authenticate] }, async (request) => {
    const query = feedQuerySchema.parse(request.query);
    const userId = request.user.sub;
    const cacheKey = `feed:${userId}:${query.mode}:${query.filter}:${query.limit}:${query.before?.toISOString() ?? "now"}:${query.cursor ?? ""}`;
    const cached = await app.redis.get(cacheKey).catch(() => null);
    if (cached) {
      return JSON.parse(cached);
    }
    const remember = async <R>(result: R) => {
      await app.redis.set(cacheKey, JSON.stringify(result), "EX", 60).catch(() => undefined);
      return result;
    };

    // Next page of a ranked snapshot: no ranking work at all.
    const cursor = query.mode === "for_you" ? parseCursor(query.cursor) : null;
    const snapshotKey = (id: string) => `feedsnap:${userId}:${query.filter}:${id}`;
    const servePage = async (snapshotId: string, snapshot: Snapshot, offset: number) => {
      const pageKeys = snapshot.keys.slice(offset, offset + query.limit);
      const end = offset + pageKeys.length;
      const more = end < snapshot.keys.length || (snapshot.frontier !== null && snapshot.keys.length < SNAPSHOT_MAX);
      return remember({
        data: await enrichFeedItems(app, userId, await loadItemsByKeys(app, pageKeys)),
        nextCursor: more ? `${snapshotId}.${end}` : null,
        algorithm: "behavioral_ranking_v3"
      });
    };

    let snapshot: Snapshot | null = null;
    if (cursor) {
      const stored = await app.redis.get(snapshotKey(cursor.snapshotId)).catch(() => null);
      snapshot = stored ? (JSON.parse(stored) as Snapshot) : null;
      // Within the ranked list (or nothing older left): no ranking work at all.
      if (snapshot && (cursor.offset + query.limit <= snapshot.keys.length || snapshot.frontier === null || snapshot.keys.length >= SNAPSHOT_MAX)) {
        return servePage(cursor.snapshotId, snapshot, cursor.offset);
      }
      // Past the end: the next older batch is ranked below. Expired: ranked again, continuing from the same offset.
    }

    const [user, follows, blockedIds, mutedRows] = await Promise.all([
      app.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      app.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true }
      }),
      getBlockedIds(app, userId),
      app.prisma.userMute.findMany({
        where: { muterId: userId },
        select: { mutedId: true }
      })
    ]);

    const followingIds = new Set(follows.map((f) => f.followingId));
    const mutedIds = new Set(mutedRows.map((m) => m.mutedId));
    const hiddenAuthorIds = [...blockedIds, ...mutedIds];

    if (query.mode === "for_you" && !cursor && await needsColdStart(app, userId)) {
      const coldItems = await getColdStartFeed(app, userId, user.interests, query.limit);
      return remember({
        data: await enrichFeedItems(app, userId, coldItems.slice(0, query.limit)),
        nextCursor: null,
        algorithm: "cold_start_v1"
      });
    }

    if (query.mode === "following") {
      const beforeFilter = query.before ? { publishedAt: { lt: query.before } } : {};
      const where = { ...visibleWhere(hiddenAuthorIds), authorId: { in: [...followingIds] }, ...beforeFilter };
      const [articles, reviews] = await Promise.all([
        query.filter === "books"
          ? Promise.resolve([])
          : app.prisma.article.findMany({ where, take: query.limit, orderBy: { publishedAt: "desc" }, include: { author: authorSelect } }),
        query.filter === "articles"
          ? Promise.resolve([])
          : app.prisma.review.findMany({ where, take: query.limit, orderBy: { publishedAt: "desc" }, include: { author: authorSelect, book: true } })
      ]);
      const data = [...articles.map(articleToFeedItem), ...reviews.map(reviewToFeedItem)]
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, query.limit);
      return remember({
        data: await enrichFeedItems(app, userId, data),
        nextCursor: data.length === query.limit ? data.at(-1)?.publishedAt.toISOString() ?? null : null,
        algorithm: "following_recency_v1"
      });
    }

    const ctx = { userId, filter: query.filter, hiddenAuthorIds, interests: user.interests };
    const rank = async (items: Awaited<ReturnType<typeof loadCandidates>>["items"]) =>
      diversifyByAuthor(await scoreFeedItems(app, userId, items, followingIds, user.interests, mutedIds, blockedIds)).map(
        (item) => `${item.targetType}:${item.targetId}`
      );

    if (snapshot?.frontier) {
      // A few older batches at most, until this page fills (a batch may hold only posts already in the list).
      const known = new Set(snapshot.keys);
      const need = (cursor?.offset ?? 0) + query.limit;
      for (let i = 0; i < 5 && snapshot.frontier && snapshot.keys.length < need; i++) {
        const older = await loadCandidates(app, ctx, new Date(snapshot.frontier));
        const keys = await rank(older.items.filter((item) => !known.has(`${item.targetType}:${item.targetId}`)));
        keys.forEach((key) => known.add(key));
        snapshot = { keys: [...snapshot.keys, ...keys].slice(0, SNAPSHOT_MAX), frontier: older.frontier };
      }
    } else {
      const pool = await loadCandidates(app, ctx);
      snapshot = { keys: await rank(pool.items), frontier: pool.frontier };
    }

    const snapshotId = cursor?.snapshotId ?? randomUUID();
    await app.redis.set(snapshotKey(snapshotId), JSON.stringify(snapshot), "EX", SNAPSHOT_TTL_SECONDS).catch(() => undefined);
    return servePage(snapshotId, snapshot, Math.min(cursor?.offset ?? 0, snapshot.keys.length));
  });
};
