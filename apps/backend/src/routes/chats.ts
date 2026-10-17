import { MessageType } from "@prisma/client";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createNotification } from "../services/notificationService.js";
import { getBlockedIds } from "../services/blockService.js";
import { withIdempotency } from "../services/idempotencyService.js";
import { getPagination, pageResult, takePlusOne } from "../utils/pagination.js";
import { asApi, type ApiChatMessage, type ApiConversation, type ApiConversationBase, type Page } from "../contracts/api.js";

const directConversationSchema = z.object({
  userId: z.string().uuid()
});

const messageSchema = z.object({
  type: z.nativeEnum(MessageType).default("TEXT"),
  body: z.string().max(10000).optional(),
  sharedBookId: z.string().uuid().optional(),
  sharedArticleId: z.string().uuid().optional(),
  sharedReviewId: z.string().uuid().optional()
});

const userPreview = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true
} as const;

async function ensureConversationMember(app: FastifyInstance, conversationId: string, userId: string) {
  return app.prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId
      }
    }
  });
}

async function hasBlockBetween(app: FastifyInstance, userA: string, userB: string) {
  return Boolean(
    await app.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userA, blockedId: userB },
          { blockerId: userB, blockedId: userA }
        ]
      },
      select: { id: true }
    })
  );
}

async function assertChatRateLimit(app: FastifyInstance, userId: string, reply: any) {
  const minuteKey = `rate:chat:${userId}:minute`;
  const dayKey = `rate:chat:${userId}:day`;
  const [minuteCount, dayCount] = await Promise.all([
    app.redis.incr(minuteKey).catch(() => 1),
    app.redis.incr(dayKey).catch(() => 1)
  ]);

  if (minuteCount === 1) {
    await app.redis.expire(minuteKey, 60).catch(() => undefined);
  }
  if (dayCount === 1) {
    await app.redis.expire(dayKey, 24 * 60 * 60).catch(() => undefined);
  }

  if (minuteCount > 30 || dayCount > 500) {
    throw reply.tooManyRequests("Message rate limit exceeded");
  }
}

function directKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.get("/conversations", { preHandler: [app.authenticate] }, async (request) => {
    const blockedIds = await getBlockedIds(app, request.user.sub);
    const conversations = await app.prisma.conversation.findMany({
      where: {
        members: {
          some: { userId: request.user.sub }
        },
        NOT: {
          members: {
            some: { userId: { in: [...blockedIds] } }
          }
        }
      },
      orderBy: { updatedAt: "desc" },
      include: {
        members: {
          include: { user: { select: userPreview } }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" }
        }
      }
    });
    // Unread badge: messages from the others since this user last opened the chat.
    const unread = await Promise.all(
      conversations.map((c) => {
        const lastReadAt = c.members.find((m) => m.userId === request.user.sub)?.lastReadAt;
        return app.prisma.message.count({
          where: {
            conversationId: c.id,
            senderId: { not: request.user.sub },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {})
          }
        });
      })
    );
    return asApi<ApiConversation[]>(conversations.map((c, i) => ({ ...c, unreadCount: unread[i] ?? 0 })));
  });

  // Chat search: the user's own text messages containing the query (newest first), in chats with no blocked member.
  app.get("/messages/search", { preHandler: [app.authenticate] }, async (request) => {
    const { q } = z.object({ q: z.string().trim().min(1).max(100) }).parse(request.query);
    const blockedIds = await getBlockedIds(app, request.user.sub);
    const messages = await app.prisma.message.findMany({
      where: {
        deletedAt: null,
        body: { contains: q, mode: "insensitive" },
        conversation: {
          members: { some: { userId: request.user.sub } },
          NOT: { members: { some: { userId: { in: [...blockedIds] } } } }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, conversationId: true, senderId: true, body: true, createdAt: true }
    });
    return asApi<ApiChatMessage[]>(messages);
  });

  app.post("/conversations/direct", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = directConversationSchema.parse(request.body);
    if (body.userId === request.user.sub) {
      throw reply.badRequest("Cannot create a direct conversation with yourself");
    }

    const otherUser = await app.prisma.user.findUnique({ where: { id: body.userId } });
    if (!otherUser) {
      throw reply.notFound("User not found");
    }
    if (await hasBlockBetween(app, request.user.sub, body.userId)) {
      throw reply.forbidden("Conversation is not available");
    }

    const key = directKey(request.user.sub, body.userId);
    const conversation = await app.prisma.conversation.upsert({
      where: { directKey: key },
      update: {},
      create: {
        type: "DIRECT",
        directKey: key,
        members: {
          create: [{ userId: request.user.sub }, { userId: body.userId }]
        }
      },
      include: {
        members: { include: { user: { select: userPreview } } }
      }
    });

    app.io.to(`user:${body.userId}`).emit("conversation:created", conversation);
    return reply.status(201).send(asApi<ApiConversationBase>(conversation));
  });

  app.get("/conversations/:id/messages", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const member = await ensureConversationMember(app, id, request.user.sub);
    if (!member) {
      throw reply.notFound("Conversation not found");
    }
    const blockedIds = await getBlockedIds(app, request.user.sub);
    if (blockedIds.size > 0) {
      const blockedMember = await app.prisma.conversationMember.findFirst({
        where: { conversationId: id, userId: { in: [...blockedIds] } },
        select: { id: true }
      });
      if (blockedMember) {
        throw reply.notFound("Conversation not found");
      }
    }

    const { limit, cursor } = getPagination(request.query);
    const messages = await app.prisma.message.findMany({
      where: { conversationId: id, deletedAt: null },
      take: takePlusOne(limit),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: userPreview },
        sharedBook: true
      }
    });

    return asApi<Page<ApiChatMessage>>(pageResult(messages, limit));
  });

  app.post("/conversations/:id/messages", { preHandler: [app.authenticate] }, async (request, reply) => {
    const result = await withIdempotency(request, reply, async () => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = messageSchema.parse(request.body);
    const member = await ensureConversationMember(app, id, request.user.sub);
    if (!member) {
      throw reply.notFound("Conversation not found");
    }
    await assertChatRateLimit(app, request.user.sub, reply);

    const recipientsForSafety = await app.prisma.conversationMember.findMany({
      where: {
        conversationId: id,
        userId: { not: request.user.sub }
      },
      select: { userId: true }
    });
    const blockedRecipient = await Promise.all(
      recipientsForSafety.map((recipient) => hasBlockBetween(app, request.user.sub, recipient.userId))
    );
    if (blockedRecipient.some(Boolean)) {
      throw reply.forbidden("Conversation is not available");
    }

    if (body.type === "TEXT" && !body.body) {
      throw reply.badRequest("Text message body is required");
    }
    if (body.type === "SHARE_BOOK" && !body.sharedBookId) {
      throw reply.badRequest("sharedBookId is required");
    }
    if (body.type === "SHARE_ARTICLE" && !body.sharedArticleId) {
      throw reply.badRequest("sharedArticleId is required");
    }
    if (body.type === "SHARE_REVIEW" && !body.sharedReviewId) {
      throw reply.badRequest("sharedReviewId is required");
    }

    const message = await app.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId: id,
          senderId: request.user.sub,
          type: body.type,
          body: body.body,
          sharedBookId: body.sharedBookId,
          sharedArticleId: body.sharedArticleId,
          sharedReviewId: body.sharedReviewId
        },
        include: {
          sender: { select: userPreview },
          sharedBook: true
        }
      });

      await tx.conversation.update({
        where: { id },
        data: { updatedAt: new Date() }
      });

      return created;
    });

    app.io.to(`conversation:${id}`).emit("message:new", message);

    const recipients = await app.prisma.conversationMember.findMany({
      where: {
        conversationId: id,
        userId: { not: request.user.sub }
      },
      select: { userId: true }
    });

    await Promise.all(
      recipients.map((recipient) =>
        createNotification(app, {
          userId: recipient.userId,
          type: "MESSAGE",
          actorType: "USER",
          actorId: request.user.sub,
          targetType: "CONVERSATION",
          targetId: id,
          title: "New message",
          body: body.type === "TEXT" ? body.body : "Shared something with you.",
          data: { messageId: message.id, messageType: message.type }
        })
      )
    );

      return { statusCode: 201, body: asApi<ApiChatMessage>(message) };
    });

    return reply.status(result.statusCode ?? 201).send(result.body);
  });

  app.post("/conversations/:id/read", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const member = await ensureConversationMember(app, id, request.user.sub);
    if (!member) {
      throw reply.notFound("Conversation not found");
    }

    const updated = await app.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: request.user.sub
        }
      },
      data: { lastReadAt: new Date() }
    });

    app.io.to(`conversation:${id}`).emit("conversation:read", {
      conversationId: id,
      userId: request.user.sub,
      lastReadAt: updated.lastReadAt
    });

    return updated;
  });
};
