import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getBlockedIds, invalidateUserFeedCache } from "../services/blockService.js";
import { getPagination, pageResult, takePlusOne } from "../utils/pagination.js";

const userIdParams = z.object({
  id: z.string().uuid()
});

export const blockRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me/blocks", { preHandler: [app.authenticate] }, async (request) => {
    const { limit, cursor } = getPagination(request.query);
    const blocks = await app.prisma.userBlock.findMany({
      where: { blockerId: request.user.sub },
      take: takePlusOne(limit),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "desc" },
      include: { blocked: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
    });

    return pageResult(blocks, limit);
  });

  app.post("/users/:id/block", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = userIdParams.parse(request.params);
    if (id === request.user.sub) {
      throw reply.badRequest("You cannot block yourself");
    }

    const user = await app.prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!user) {
      throw reply.notFound("User not found");
    }

    const block = await app.prisma.$transaction(async (tx) => {
      await tx.follow.deleteMany({
        where: {
          OR: [
            { followerId: request.user.sub, followingId: id },
            { followerId: id, followingId: request.user.sub }
          ]
        }
      });
      await tx.userMute.deleteMany({ where: { muterId: request.user.sub, mutedId: id } });
      return tx.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: request.user.sub, blockedId: id } },
        create: { blockerId: request.user.sub, blockedId: id },
        update: {}
      });
    });

    await Promise.all([
      invalidateUserFeedCache(app, request.user.sub),
      invalidateUserFeedCache(app, id)
    ]);

    return reply.status(201).send(block);
  });

  app.delete("/users/:id/block", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = userIdParams.parse(request.params);
    await app.prisma.userBlock.deleteMany({
      where: { blockerId: request.user.sub, blockedId: id }
    });
    await invalidateUserFeedCache(app, request.user.sub);
    return { ok: true };
  });

  app.get("/me/mutes", { preHandler: [app.authenticate] }, async (request) => {
    const { limit, cursor } = getPagination(request.query);
    const mutes = await app.prisma.userMute.findMany({
      where: { muterId: request.user.sub },
      take: takePlusOne(limit),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "desc" },
      include: { muted: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
    });

    return pageResult(mutes, limit);
  });

  app.post("/users/:id/mute", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = userIdParams.parse(request.params);
    if (id === request.user.sub) {
      throw reply.badRequest("You cannot mute yourself");
    }

    const user = await app.prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!user) {
      throw reply.notFound("User not found");
    }

    const blockedIds = await getBlockedIds(app, request.user.sub);
    if (blockedIds.has(id)) {
      throw reply.badRequest("Blocked users are already hidden");
    }

    const mute = await app.prisma.userMute.upsert({
      where: { muterId_mutedId: { muterId: request.user.sub, mutedId: id } },
      create: { muterId: request.user.sub, mutedId: id },
      update: {}
    });

    await invalidateUserFeedCache(app, request.user.sub);
    return reply.status(201).send(mute);
  });

  app.delete("/users/:id/mute", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = userIdParams.parse(request.params);
    await app.prisma.userMute.deleteMany({
      where: { muterId: request.user.sub, mutedId: id }
    });
    await invalidateUserFeedCache(app, request.user.sub);
    return { ok: true };
  });
};
