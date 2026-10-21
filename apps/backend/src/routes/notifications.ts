import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { asApi, type ApiNotification, type Page } from "../contracts/api.js";
import { getPagination, pageResult, takePlusOne } from "../utils/pagination.js";

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/notifications", { preHandler: [app.authenticate] }, async (request) => {
    const query = z
      .object({
        unreadOnly: z.stringbool().default(false)
      })
      .merge(z.object({ limit: z.coerce.number().int().min(1).max(100).default(30), cursor: z.string().optional() }))
      .parse(request.query);

    const notifications = await app.prisma.notification.findMany({
      where: {
        userId: request.user.sub,
        ...(query.unreadOnly ? { readAt: null } : {})
      },
      take: takePlusOne(query.limit),
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });

    // What the list shows besides the actor: the article's cover for likes / comments, and whether the viewer
    // already follows a new follower back.
    const articleIds = [...new Set(notifications.flatMap((n) => (n.targetType === "ARTICLE" && n.targetId ? [n.targetId] : [])))];
    const followerIds = [...new Set(notifications.flatMap((n) => (n.type === "FOLLOW" && n.actorId ? [n.actorId] : [])))];
    const [articles, followed] = await Promise.all([
      articleIds.length
        ? app.prisma.article.findMany({ where: { id: { in: articleIds }, deletedAt: null }, select: { id: true, title: true, coverImageUrl: true } })
        : [],
      followerIds.length
        ? app.prisma.follow.findMany({ where: { followerId: request.user.sub, followingId: { in: followerIds } }, select: { followingId: true } })
        : []
    ]);
    const articleById = new Map(articles.map((a) => [a.id, a]));
    const followedIds = new Set(followed.map((f) => f.followingId));
    const page = pageResult(notifications, query.limit);
    return asApi<Page<ApiNotification>>({
      ...page,
      data: page.data.map((n) => ({
        ...n,
        article: n.targetType === "ARTICLE" && n.targetId ? (articleById.get(n.targetId) ?? null) : null,
        actorFollowed: n.actorId ? followedIds.has(n.actorId) : false
      }))
    });
  });

  app.get("/notifications/unread-count", { preHandler: [app.authenticate] }, async (request) => {
    const count = await app.prisma.notification.count({
      where: {
        userId: request.user.sub,
        readAt: null
      }
    });

    return { count };
  });

  app.post("/notifications/:id/read", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const notification = await app.prisma.notification.findFirst({
      where: {
        id,
        userId: request.user.sub
      }
    });

    if (!notification) {
      throw reply.notFound("Notification not found");
    }

    return app.prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() }
    });
  });

  app.post("/notifications/read-all", { preHandler: [app.authenticate] }, async (request) => {
    const now = new Date();
    const result = await app.prisma.notification.updateMany({
      where: {
        userId: request.user.sub,
        readAt: null
      },
      data: { readAt: now }
    });

    return { ok: true, count: result.count };
  });
};
