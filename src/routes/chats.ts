import { MessageType } from "@prisma/client";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPagination, pageResult, takePlusOne } from "../utils/pagination.js";

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

function directKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.get("/conversations", { preHandler: [app.authenticate] }, async (request) => {
    return app.prisma.conversation.findMany({
      where: {
        members: {
          some: { userId: request.user.sub }
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
    return reply.status(201).send(conversation);
  });

  app.get("/conversations/:id/messages", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const member = await ensureConversationMember(app, id, request.user.sub);
    if (!member) {
      throw reply.notFound("Conversation not found");
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

    return pageResult(messages, limit);
  });

  app.post("/conversations/:id/messages", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = messageSchema.parse(request.body);
    const member = await ensureConversationMember(app, id, request.user.sub);
    if (!member) {
      throw reply.notFound("Conversation not found");
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
    return reply.status(201).send(message);
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
