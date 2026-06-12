import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createNotification } from "../services/notificationService.js";
import { publicUserSelect } from "../utils/users.js";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().url().optional(),
  interests: z.array(z.string().min(1).max(40)).max(20).optional()
});

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get("/users/:username", async (request, reply) => {
    const { username } = z.object({ username: z.string() }).parse(request.params);
    const user = await app.prisma.user.findUnique({
      where: { username },
      select: {
        ...publicUserSelect,
        _count: {
          select: {
            followers: true,
            following: true,
            authoredArticles: true,
            authoredReviews: true
          }
        },
        shelfItems: {
          take: 12,
          orderBy: { updatedAt: "desc" },
          include: { book: true }
        },
        stories: {
          where: {
            status: "ACTIVE",
            expiresAt: { gt: new Date() }
          },
          take: 1,
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!user) {
      throw reply.notFound("User not found");
    }

    return user;
  });

  app.patch("/users/me", { preHandler: [app.authenticate] }, async (request) => {
    const body = updateProfileSchema.parse(request.body);
    return app.prisma.user.update({
      where: { id: request.user.sub },
      data: body,
      select: publicUserSelect
    });
  });

  app.post("/users/:id/follow", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    if (id === request.user.sub) {
      throw reply.badRequest("You cannot follow yourself");
    }

    // Blocked users cannot follow each other (in either direction).
    const block = await app.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: request.user.sub, blockedId: id },
          { blockerId: id, blockedId: request.user.sub }
        ]
      },
      select: { blockerId: true }
    });
    if (block) {
      throw reply.forbidden("Follow is not allowed");
    }

    const existing = await app.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: request.user.sub, followingId: id } },
      select: { followerId: true }
    });

    await app.prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: request.user.sub,
          followingId: id
        }
      },
      update: {},
      create: {
        followerId: request.user.sub,
        followingId: id
      }
    });

    // Send follow notification only on first follow, not on repeated calls.
    if (!existing) {
      await createNotification(app, {
        userId: id,
        type: "FOLLOW",
        actorType: "USER",
        actorId: request.user.sub,
        targetType: "USER",
        targetId: request.user.sub,
        title: "New follower",
        body: `${request.user.username} started following you.`
      });
    }

    return { ok: true };
  });

  app.delete("/users/:id/follow", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await app.prisma.follow.deleteMany({
      where: {
        followerId: request.user.sub,
        followingId: id
      }
    });

    return { ok: true };
  });
};
