import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { createNotification } from "../services/notificationService.js";
import { publicUserSelect } from "../utils/users.js";
import { getPagination, pageResult, takePlusOne } from "../utils/pagination.js";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  bio: z.string().max(1000).optional(),
  // An AVATAR asset the user uploaded via POST /media; null removes the avatar. Arbitrary URLs are not accepted.
  avatarMediaId: z.string().uuid().nullable().optional(),
  interests: z.array(z.string().min(1).max(40)).max(20).optional()
});

const listUserSelect = { id: true, username: true, displayName: true, avatarUrl: true } as const;

export const userRoutes: FastifyPluginAsync = async (app) => {
  // Public routes that still personalize the response when a valid token is sent.
  async function viewerId(request: FastifyRequest): Promise<string | null> {
    if (!request.headers.authorization) return null;
    try {
      await request.jwtVerify();
      return request.user.sub;
    } catch {
      return null;
    }
  }

  async function userIdByUsername(username: string, reply: FastifyReply) {
    const user = await app.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) throw reply.notFound("User not found");
    return user.id;
  }

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

    const viewer = await viewerId(request);
    const isFollowing =
      viewer && viewer !== user.id
        ? Boolean(
            await app.prisma.follow.findUnique({
              where: { followerId_followingId: { followerId: viewer, followingId: user.id } },
              select: { id: true }
            })
          )
        : false;

    return { ...user, isFollowing, isMe: viewer === user.id };
  });

  app.get("/users/:username/articles", async (request, reply) => {
    const { username } = z.object({ username: z.string() }).parse(request.params);
    const { limit, cursor } = getPagination(request.query);
    const authorId = await userIdByUsername(username, reply);
    const articles = await app.prisma.article.findMany({
      where: { authorId, status: "PUBLISHED", moderationStatus: "APPROVED", deletedAt: null },
      take: takePlusOne(limit),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { publishedAt: "desc" },
      include: { author: { select: listUserSelect } }
    });
    const page = pageResult(articles, limit);
    const likes = await app.prisma.like.groupBy({
      by: ["targetId"],
      where: { targetType: "ARTICLE", targetId: { in: page.data.map((a) => a.id) } },
      _count: { _all: true }
    });
    const likeCount = new Map(likes.map((l) => [l.targetId, l._count._all]));
    return { ...page, data: page.data.map((a) => ({ ...a, likeCount: likeCount.get(a.id) ?? 0 })) };
  });

  // followers: who follows :username; following: whom :username follows.
  for (const kind of ["followers", "following"] as const) {
    app.get(`/users/:username/${kind}`, async (request, reply) => {
      const { username } = z.object({ username: z.string() }).parse(request.params);
      const { limit, cursor } = getPagination(request.query);
      const userId = await userIdByUsername(username, reply);
      const rows = await app.prisma.follow.findMany({
        where: kind === "followers" ? { followingId: userId } : { followerId: userId },
        take: takePlusOne(limit),
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          follower: kind === "followers" ? { select: listUserSelect } : false,
          following: kind === "following" ? { select: listUserSelect } : false
        }
      });
      const page = pageResult(rows, limit);
      const users = page.data.map((row) => (kind === "followers" ? row.follower : row.following)!);

      const viewer = await viewerId(request);
      const followed = viewer
        ? new Set(
            (
              await app.prisma.follow.findMany({
                where: { followerId: viewer, followingId: { in: users.map((u) => u.id) } },
                select: { followingId: true }
              })
            ).map((f) => f.followingId)
          )
        : new Set<string>();

      return {
        data: users.map((u) => ({ ...u, isFollowing: followed.has(u.id), isMe: u.id === viewer })),
        nextCursor: page.nextCursor
      };
    });
  }

  app.patch("/users/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { avatarMediaId, ...body } = updateProfileSchema.parse(request.body);
    let avatarUrl: string | null | undefined;
    if (avatarMediaId === null) {
      avatarUrl = null;
    } else if (avatarMediaId) {
      const asset = await app.prisma.mediaAsset.findFirst({
        where: { id: avatarMediaId, ownerId: request.user.sub, kind: "AVATAR", moderationStatus: { not: "REJECTED" } },
        select: { url: true }
      });
      if (!asset) {
        throw reply.badRequest("Unknown avatar media");
      }
      avatarUrl = asset.url;
    }
    return app.prisma.user.update({
      where: { id: request.user.sub },
      data: { ...body, ...(avatarUrl !== undefined ? { avatarUrl } : {}) },
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
