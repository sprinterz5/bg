import { BookmarkTargetType } from "@prisma/client";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { incrementContentScore } from "../services/contentScoreService.js";
import { incrementContentCounter } from "../services/counterService.js";
import { createNotification } from "../services/notificationService.js";
import { getPagination, pageResult, takePlusOne } from "../utils/pagination.js";

const bookmarkSchema = z.object({
  targetType: z.nativeEnum(BookmarkTargetType),
  targetId: z.string().uuid()
});

async function getBookmarkTarget(app: FastifyInstance, targetType: BookmarkTargetType, targetId: string, currentUserId: string) {
  switch (targetType) {
    case "ARTICLE":
      return app.prisma.article.findFirst({
        where: { id: targetId, status: "PUBLISHED", moderationStatus: "APPROVED", deletedAt: null },
        select: { id: true, title: true, authorId: true }
      });
    case "REVIEW":
      return app.prisma.review.findFirst({
        where: { id: targetId, status: "PUBLISHED", moderationStatus: "APPROVED", deletedAt: null },
        select: { id: true, title: true, authorId: true }
      });
    case "BOOK":
      return app.prisma.book.findUnique({
        where: { id: targetId },
        select: { id: true, title: true }
      });
    case "NOTE":
      // Notes are private; only the owner may bookmark their own note.
      return app.prisma.note.findFirst({
        where: { id: targetId, userId: currentUserId },
        select: { id: true, noteText: true, userId: true }
      });
  }
}

export const bookmarkRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me/bookmarks", { preHandler: [app.authenticate] }, async (request) => {
    const query = z
      .object({
        targetType: z.nativeEnum(BookmarkTargetType).optional()
      })
      .merge(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.string().optional() }))
      .parse(request.query);

    const bookmarks = await app.prisma.bookmark.findMany({
      where: {
        userId: request.user.sub,
        ...(query.targetType ? { targetType: query.targetType } : {})
      },
      take: takePlusOne(query.limit),
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: "desc" }
    });

    return pageResult(bookmarks, query.limit);
  });

  app.post("/bookmarks/toggle", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = bookmarkSchema.parse(request.body);
    const target = await getBookmarkTarget(app, body.targetType, body.targetId, request.user.sub);
    if (!target) {
      throw reply.notFound("Bookmark target not found");
    }

    const existing = await app.prisma.bookmark.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: request.user.sub,
          targetType: body.targetType,
          targetId: body.targetId
        }
      }
    });

    if (existing) {
      await app.prisma.bookmark.delete({ where: { id: existing.id } });
      await incrementContentScore(app, body.targetType, body.targetId, { saves: -1 });
      await incrementContentCounter(app, body.targetType, body.targetId, { bookmarks: -1 });
      return { bookmarked: false };
    }

    const bookmark = await app.prisma.bookmark.create({
      data: {
        userId: request.user.sub,
        targetType: body.targetType,
        targetId: body.targetId
      }
    });

    await incrementContentScore(app, body.targetType, body.targetId, { saves: 1 });
    await incrementContentCounter(app, body.targetType, body.targetId, { bookmarks: 1 });

    if (body.targetType === "ARTICLE" || body.targetType === "REVIEW") {
      const contentTarget =
        body.targetType === "ARTICLE"
          ? await app.prisma.article.findUnique({
              where: { id: body.targetId },
              select: { authorId: true, title: true }
            })
          : await app.prisma.review.findUnique({
              where: { id: body.targetId },
              select: { authorId: true, title: true }
            });
      if (!contentTarget) {
        return { bookmarked: true, bookmark };
      }

      if (contentTarget.authorId === request.user.sub) {
        return { bookmarked: true, bookmark };
      }

      await createNotification(app, {
        userId: contentTarget.authorId,
        type: "BOOKMARK",
        actorType: "USER",
        actorId: request.user.sub,
        targetType: body.targetType,
        targetId: body.targetId,
        title: "Saved",
        body: `${request.user.username} saved "${contentTarget.title}".`,
        data: { bookmarkId: bookmark.id }
      });
    }

    return { bookmarked: true, bookmark };
  });
};
