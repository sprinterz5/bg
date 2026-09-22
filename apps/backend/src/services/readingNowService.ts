import type { FastifyInstance } from "fastify";
import { getBlockedIds } from "./blockService.js";

function bookMedia(book: { thumbnailUrl: string | null }) {
  return book.thumbnailUrl
    ? {
        kind: "BOOK_COVER" as const,
        url: book.thumbnailUrl,
        thumbnailUrl: book.thumbnailUrl,
        aspectRatio: 0.66,
        width: null,
        height: null
      }
    : null;
}

export async function getFriendsReadingNow(app: FastifyInstance, userId: string, limit = 20) {
  const [follows, blockedIds, mutedRows] = await Promise.all([
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

  const mutedIds = new Set(mutedRows.map((row) => row.mutedId));
  const followingIds = follows
    .map((follow) => follow.followingId)
    .filter((id) => !blockedIds.has(id) && !mutedIds.has(id));

  if (followingIds.length === 0) {
    return [];
  }

  const readingRows = await app.prisma.shelfItem.findMany({
    where: {
      userId: { in: followingIds },
      status: "READING"
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      book: true
    }
  });

  return readingRows.map((row) => ({
    id: row.id,
    user: row.user,
    book: row.book,
    media: bookMedia(row.book),
    reading: {
      status: row.status,
      progressPage: row.progressPage,
      progressPercent: row.progressPercent,
      startedAt: row.startedAt,
      updatedAt: row.updatedAt
    }
  }));
}

export async function getMyReadingNow(app: FastifyInstance, userId: string) {
  const row = await app.prisma.shelfItem.findFirst({
    where: {
      userId,
      status: "READING"
    },
    orderBy: { updatedAt: "desc" },
    include: { book: true }
  });

  return row
    ? {
        id: row.id,
        book: row.book,
        media: bookMedia(row.book),
        reading: {
          status: row.status,
          progressPage: row.progressPage,
          progressPercent: row.progressPercent,
          startedAt: row.startedAt,
          updatedAt: row.updatedAt
        }
      }
    : null;
}
