import type { ContentCounterTargetType } from "@prisma/client";
import type { FastifyInstance } from "fastify";

type CounterDelta = {
  likes?: number;
  comments?: number;
  bookmarks?: number;
  shares?: number;
  reports?: number;
  views?: number;
};

export async function incrementContentCounter(
  app: FastifyInstance,
  targetType: string,
  targetId: string,
  delta: CounterDelta
) {
  const supported = ["ARTICLE", "REVIEW", "STORY", "NOTE", "COMMENT", "BOOK"];
  if (!supported.includes(targetType)) {
    return null;
  }

  const typedTarget = targetType as ContentCounterTargetType;
  return app.prisma.contentCounter.upsert({
    where: {
      targetType_targetId: {
        targetType: typedTarget,
        targetId
      }
    },
    create: {
      targetType: typedTarget,
      targetId,
      likes: delta.likes ?? 0,
      comments: delta.comments ?? 0,
      bookmarks: delta.bookmarks ?? 0,
      shares: delta.shares ?? 0,
      reports: delta.reports ?? 0,
      views: delta.views ?? 0
    },
    update: {
      ...(delta.likes ? { likes: { increment: delta.likes } } : {}),
      ...(delta.comments ? { comments: { increment: delta.comments } } : {}),
      ...(delta.bookmarks ? { bookmarks: { increment: delta.bookmarks } } : {}),
      ...(delta.shares ? { shares: { increment: delta.shares } } : {}),
      ...(delta.reports ? { reports: { increment: delta.reports } } : {}),
      ...(delta.views ? { views: { increment: delta.views } } : {})
    }
  });
}
