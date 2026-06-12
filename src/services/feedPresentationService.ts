import type { FastifyInstance } from "fastify";

type PresentableFeedItem = {
  targetType: "ARTICLE" | "REVIEW";
  targetId: string;
  coverImageUrl?: string | null;
  book?: {
    thumbnailUrl?: string | null;
  } | null;
};

function keyFor(targetType: string, targetId: string) {
  return `${targetType}:${targetId}`;
}

function mediaForItem(item: PresentableFeedItem) {
  if (item.targetType === "ARTICLE") {
    return item.coverImageUrl
      ? {
          kind: "ARTICLE_COVER" as const,
          url: item.coverImageUrl,
          thumbnailUrl: item.coverImageUrl,
          aspectRatio: null,
          width: null,
          height: null
        }
      : null;
  }

  return item.book?.thumbnailUrl
    ? {
        kind: "BOOK_COVER" as const,
        url: item.book.thumbnailUrl,
        thumbnailUrl: item.book.thumbnailUrl,
        aspectRatio: 0.66,
        width: null,
        height: null
      }
    : null;
}

export async function enrichFeedItems<T extends PresentableFeedItem>(
  app: FastifyInstance,
  userId: string,
  items: T[]
) {
  if (items.length === 0) {
    return [];
  }

  const targetPairs = items.map((item) => ({
    targetType: item.targetType,
    targetId: item.targetId
  }));

  const [likes, bookmarks, counters, scores] = await Promise.all([
    app.prisma.like.findMany({
      where: {
        userId,
        OR: targetPairs
      },
      select: { targetType: true, targetId: true }
    }),
    app.prisma.bookmark.findMany({
      where: {
        userId,
        OR: targetPairs
      },
      select: { targetType: true, targetId: true }
    }),
    app.prisma.contentCounter.findMany({
      where: { OR: targetPairs }
    }),
    app.prisma.contentScore.findMany({
      where: {
        OR: targetPairs
      }
    })
  ]);

  const liked = new Set(likes.map((like) => keyFor(like.targetType, like.targetId)));
  const bookmarked = new Set(bookmarks.map((bookmark) => keyFor(bookmark.targetType, bookmark.targetId)));
  const counterMap = new Map(counters.map((counter) => [keyFor(counter.targetType, counter.targetId), counter]));
  const scoreMap = new Map(scores.map((score) => [keyFor(score.targetType, score.targetId), score]));

  return items.map((item) => {
    const key = keyFor(item.targetType, item.targetId);
    const score = scoreMap.get(key);
    const counter = counterMap.get(key);
    return {
      ...item,
      media: mediaForItem(item),
      viewer: {
        liked: liked.has(key),
        bookmarked: bookmarked.has(key)
      },
      counts: {
        likes: counter?.likes ?? score?.likes ?? 0,
        comments: counter?.comments ?? score?.comments ?? 0,
        bookmarks: counter?.bookmarks ?? score?.saves ?? 0,
        shares: counter?.shares ?? score?.shares ?? 0
      }
    };
  });
}
