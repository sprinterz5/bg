import { CommentTargetType, UserRole } from "@prisma/client";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createNotification } from "../services/notificationService.js";
import { incrementContentScore } from "../services/contentScoreService.js";
import { incrementContentCounter } from "../services/counterService.js";
import { endpointRateLimit } from "../services/rateLimitService.js";
import { withIdempotency } from "../services/idempotencyService.js";
import { getPagination, pageResult, takePlusOne } from "../utils/pagination.js";

const commentCreateSchema = z.object({
  targetType: z.nativeEnum(CommentTargetType),
  targetId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  body: z.string().min(1).max(4000)
});

const commentUpdateSchema = z.object({
  body: z.string().min(1).max(4000)
});

async function getCommentTarget(app: FastifyInstance, targetType: CommentTargetType, targetId: string) {
  if (targetType === "ARTICLE") {
    return app.prisma.article.findFirst({
      where: { id: targetId, status: "PUBLISHED", moderationStatus: "APPROVED", deletedAt: null },
      select: { id: true, title: true, authorId: true }
    });
  }

  return app.prisma.review.findFirst({
    where: { id: targetId, status: "PUBLISHED", moderationStatus: "APPROVED", deletedAt: null },
    select: { id: true, title: true, authorId: true }
  });
}

export const commentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/comments", { preHandler: [app.authenticate] }, async (request) => {
    const query = z
      .object({
        targetType: z.nativeEnum(CommentTargetType),
        targetId: z.string().uuid(),
        parentId: z.string().uuid().nullable().optional()
      })
      .merge(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.string().optional() }))
      .parse(request.query);

    const comments = await app.prisma.comment.findMany({
      where: {
        targetType: query.targetType,
        targetId: query.targetId,
        parentId: query.parentId === undefined ? null : query.parentId,
        deletedAt: null
      },
      take: takePlusOne(query.limit),
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        _count: { select: { children: true } }
      }
    });

    return pageResult(comments, query.limit);
  });

  app.post("/comments", { preHandler: [app.authenticate, endpointRateLimit({ key: "comments", limit: 40, windowSeconds: 60, by: "userOrIp" })] }, async (request, reply) => {
    const result = await withIdempotency(request, reply, async () => {
    const body = commentCreateSchema.parse(request.body);
    const target = await getCommentTarget(app, body.targetType, body.targetId);
    if (!target) {
      throw reply.notFound("Comment target not found");
    }

    let parentUserId: string | null = null;
    if (body.parentId) {
      const parent = await app.prisma.comment.findFirst({
        where: {
          id: body.parentId,
          targetType: body.targetType,
          targetId: body.targetId,
          deletedAt: null
        },
        select: { userId: true }
      });
      if (!parent) {
        throw reply.notFound("Parent comment not found");
      }
      parentUserId = parent.userId;
    }

    const comment = await app.prisma.comment.create({
      data: {
        userId: request.user.sub,
        targetType: body.targetType,
        targetId: body.targetId,
        parentId: body.parentId,
        body: body.body
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });

    await incrementContentScore(app, body.targetType, body.targetId, { comments: 1 });
    await incrementContentCounter(app, body.targetType, body.targetId, { comments: 1 });

    if (target.authorId !== request.user.sub) {
      await createNotification(app, {
        userId: target.authorId,
        type: "COMMENT",
        actorType: "USER",
        actorId: request.user.sub,
        targetType: body.targetType,
        targetId: body.targetId,
        title: "New comment",
        body: `${request.user.username} commented on "${target.title}".`,
        data: { commentId: comment.id }
      });
    }

    if (parentUserId && parentUserId !== request.user.sub && parentUserId !== target.authorId) {
      await createNotification(app, {
        userId: parentUserId,
        type: "COMMENT_REPLY",
        actorType: "USER",
        actorId: request.user.sub,
        targetType: "COMMENT",
        targetId: comment.id,
        title: "New reply",
        body: `${request.user.username} replied to your comment.`,
        data: { targetType: body.targetType, targetId: body.targetId }
      });
    }

      return { statusCode: 201, body: comment };
    });

    return reply.status(result.statusCode ?? 201).send(result.body);
  });

  app.patch("/comments/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = commentUpdateSchema.parse(request.body);
    const comment = await app.prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.deletedAt || comment.userId !== request.user.sub) {
      throw reply.notFound("Comment not found");
    }

    return app.prisma.comment.update({
      where: { id },
      data: { body: body.body },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });
  });

  app.delete("/comments/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const comment = await app.prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.deletedAt) {
      throw reply.notFound("Comment not found");
    }

    const canDelete =
      comment.userId === request.user.sub ||
      request.user.role === UserRole.MODERATOR ||
      request.user.role === UserRole.ADMIN;
    if (!canDelete) {
      throw reply.forbidden("You cannot delete this comment");
    }

    await app.prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    await incrementContentScore(app, comment.targetType, comment.targetId, { comments: -1 });
    await incrementContentCounter(app, comment.targetType, comment.targetId, { comments: -1 });

    return { ok: true };
  });
};
