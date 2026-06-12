import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createNotification } from "../services/notificationService.js";
import { recordFeedEventScoreImpact } from "../services/contentScoreService.js";
import { incrementContentCounter } from "../services/counterService.js";
import { endpointRateLimit } from "../services/rateLimitService.js";
import { withIdempotency } from "../services/idempotencyService.js";

const shareSchema = z.object({
  targetType: z.enum(["ARTICLE", "REVIEW", "BOOK"]),
  targetId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  body: z.string().max(1000).optional(),
  source: z.string().max(80).optional()
});

const userPreview = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true
} as const;

async function assertTargetExists(app: FastifyInstance, targetType: "ARTICLE" | "REVIEW" | "BOOK", targetId: string) {
  if (targetType === "ARTICLE") {
    return app.prisma.article.findFirst({
      where: { id: targetId, status: "PUBLISHED", moderationStatus: "APPROVED", deletedAt: null },
      select: { id: true }
    });
  }
  if (targetType === "REVIEW") {
    return app.prisma.review.findFirst({
      where: { id: targetId, status: "PUBLISHED", moderationStatus: "APPROVED", deletedAt: null },
      select: { id: true }
    });
  }
  return app.prisma.book.findUnique({ where: { id: targetId }, select: { id: true } });
}

async function assertConversationAvailable(app: FastifyInstance, conversationId: string, userId: string) {
  const member = await app.prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId
      }
    }
  });
  if (!member) {
    return null;
  }

  const otherMembers = await app.prisma.conversationMember.findMany({
    where: {
      conversationId,
      userId: { not: userId }
    },
    select: { userId: true }
  });
  if (otherMembers.length === 0) {
    return [];
  }

  const blocked = await app.prisma.userBlock.findFirst({
    where: {
      OR: otherMembers.flatMap((memberRow) => [
        { blockerId: userId, blockedId: memberRow.userId },
        { blockerId: memberRow.userId, blockedId: userId }
      ])
    },
    select: { id: true }
  });

  return blocked ? null : otherMembers;
}

export const shareRoutes: FastifyPluginAsync = async (app) => {
  app.post("/share", { preHandler: [app.authenticate, endpointRateLimit({ key: "share", limit: 60, windowSeconds: 60, by: "userOrIp" })] }, async (request, reply) => {
    const result = await withIdempotency(request, reply, async () => {
    const body = shareSchema.parse(request.body);
    const target = await assertTargetExists(app, body.targetType, body.targetId);
    if (!target) {
      throw reply.notFound("Share target not found");
    }

    let message: any = null;
    if (body.conversationId) {
      const recipients = await assertConversationAvailable(app, body.conversationId, request.user.sub);
      if (!recipients) {
        throw reply.notFound("Conversation not found");
      }

      const messageType =
        body.targetType === "ARTICLE" ? "SHARE_ARTICLE" : body.targetType === "REVIEW" ? "SHARE_REVIEW" : "SHARE_BOOK";

      message = await app.prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: {
            conversationId: body.conversationId!,
            senderId: request.user.sub,
            type: messageType,
            body: body.body,
            sharedBookId: body.targetType === "BOOK" ? body.targetId : undefined,
            sharedArticleId: body.targetType === "ARTICLE" ? body.targetId : undefined,
            sharedReviewId: body.targetType === "REVIEW" ? body.targetId : undefined
          },
          include: {
            sender: { select: userPreview },
            sharedBook: true
          }
        });

        await tx.conversation.update({
          where: { id: body.conversationId },
          data: { updatedAt: new Date() }
        });

        return created;
      });

      app.io.to(`conversation:${body.conversationId}`).emit("message:new", message);
      await Promise.all(
        recipients.map((recipient) =>
          createNotification(app, {
            userId: recipient.userId,
            type: "MESSAGE",
            actorType: "USER",
            actorId: request.user.sub,
            targetType: "CONVERSATION",
            targetId: body.conversationId,
            title: "Shared with you",
            body: body.body ?? "Shared something with you.",
            data: { messageId: message?.id, messageType: message?.type }
          })
        )
      );
    }

    await app.prisma.feedEvent.create({
      data: {
        userId: request.user.sub,
        eventType: "SHARE",
        targetType: body.targetType,
        targetId: body.targetId,
        source: body.source ?? "share_endpoint"
      }
    });
    await recordFeedEventScoreImpact(app, {
      eventType: "SHARE",
      targetType: body.targetType,
      targetId: body.targetId
    });
    await incrementContentCounter(app, body.targetType, body.targetId, { shares: 1 });

      return { statusCode: 201, body: {
      ok: true,
      shared: true,
      message
    } };
    });

    return reply.status(result.statusCode ?? 201).send(result.body);
  });
};
