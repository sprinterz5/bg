import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getBlockedIds } from "../services/blockService.js";
import { searchBookCandidates } from "../services/bookService.js";
import { withIdempotency } from "../services/idempotencyService.js";

const storyCreateSchema = z.object({
  bookId: z.string().uuid().optional(),
  mediaUrl: z.string().url(),
  mediaMimeType: z.string().min(1),
  caption: z.string().max(300).optional()
});

function expiresIn24Hours() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

export const storyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/stories/book-candidates", { preHandler: [app.authenticate] }, async (request) => {
    const { q } = z.object({ q: z.string().min(1).max(200) }).parse(request.query);
    const data = await searchBookCandidates(q);
    return {
      data,
      flow: "search_import_then_create_story"
    };
  });

  app.post("/stories", { preHandler: [app.authenticate] }, async (request, reply) => {
    const result = await withIdempotency(request, reply, async () => {
    const body = storyCreateSchema.parse(request.body);

    // Require story media to be an approved asset owned by this user so story
    // images are subject to the same moderation pipeline as other uploads.
    const ownedApprovedAsset = await app.prisma.mediaAsset.findFirst({
      where: { url: body.mediaUrl, ownerId: request.user.sub, moderationStatus: "APPROVED" },
      select: { id: true }
    });
    if (!ownedApprovedAsset) {
      throw reply.badRequest("mediaUrl must reference an approved media asset you have uploaded via POST /media");
    }

    if (body.bookId) {
      const book = await app.prisma.book.findUnique({ where: { id: body.bookId } });
      if (!book) {
        throw reply.notFound("Book not found");
      }

      await app.prisma.shelfItem.upsert({
        where: {
          userId_bookId: {
            userId: request.user.sub,
            bookId: body.bookId
          }
        },
        create: {
          userId: request.user.sub,
          bookId: body.bookId,
          status: "READING",
          startedAt: new Date()
        },
        update: {
          status: "READING"
        }
      });
    }

    const story = await app.prisma.story.create({
      data: {
        userId: request.user.sub,
        bookId: body.bookId,
        mediaUrl: body.mediaUrl,
        mediaMimeType: body.mediaMimeType,
        caption: body.caption,
        expiresAt: expiresIn24Hours()
      },
      include: { book: true }
    });

      return { statusCode: 201, body: story };
    });

    return reply.status(result.statusCode ?? 201).send(result.body);
  });

  app.get("/stories/me", { preHandler: [app.authenticate] }, async (request) => {
    return app.prisma.story.findMany({
      where: {
        userId: request.user.sub,
        status: "ACTIVE",
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" },
      include: { book: true, views: true }
    });
  });

  app.get("/stories/friends", { preHandler: [app.authenticate] }, async (request) => {
    const [follows, followers, blockedIds, mutedRows, myShelves] = await Promise.all([
      app.prisma.follow.findMany({
      where: { followerId: request.user.sub },
      select: { followingId: true }
      }),
      app.prisma.follow.findMany({
        where: { followingId: request.user.sub },
        select: { followerId: true }
      }),
      getBlockedIds(app, request.user.sub),
      app.prisma.userMute.findMany({
        where: { muterId: request.user.sub },
        select: { mutedId: true }
      }),
      app.prisma.shelfItem.findMany({
        where: { userId: request.user.sub },
        select: { bookId: true }
      })
    ]);

    const mutedIds = new Set(mutedRows.map((row) => row.mutedId));
    const followingIds = follows
      .map((follow) => follow.followingId)
      .filter((id) => !blockedIds.has(id) && !mutedIds.has(id));
    const mutualIds = new Set(followers.map((follow) => follow.followerId));
    const myBookIds = new Set(myShelves.map((item) => item.bookId));

    const stories = await app.prisma.story.findMany({
      where: {
        userId: { in: followingIds },
        status: "ACTIVE",
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        book: true,
        views: {
          where: { viewerId: request.user.sub },
          select: { id: true, viewedAt: true }
        }
      }
    });

    return stories.map((story) => {
      const viewed = story.views.length > 0;
      const recencyHours = Math.max((Date.now() - story.createdAt.getTime()) / 36e5, 0);
      const orderingScore =
        (viewed ? 0 : 100) +
        (mutualIds.has(story.userId) ? 35 : 0) +
        (story.bookId && myBookIds.has(story.bookId) ? 25 : 0) +
        Math.max(0, 24 - recencyHours);
      return {
        id: story.id,
        user: story.user,
        mediaUrl: story.mediaUrl,
        mediaMimeType: story.mediaMimeType,
        caption: viewed ? story.caption : null,
        book: viewed ? story.book : null,
        viewed,
        ringState: viewed ? "seen" : "unseen",
        orderingScore,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt
      };
    }).sort((a, b) => b.orderingScore - a.orderingScore);
  });

  app.post("/stories/:id/view", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const story = await app.prisma.story.findFirst({
      where: {
        id,
        status: "ACTIVE",
        expiresAt: { gt: new Date() }
      },
      include: { book: true, user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
    });

    if (!story) {
      throw reply.notFound("Story not found");
    }

    // Stories are only visible to the author or users who follow them.
    // Blocked users (in either direction) are also excluded.
    if (story.userId !== request.user.sub) {
      const [follow, block] = await Promise.all([
        app.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: request.user.sub,
              followingId: story.userId
            }
          },
          select: { followerId: true }
        }),
        app.prisma.userBlock.findFirst({
          where: {
            OR: [
              { blockerId: request.user.sub, blockedId: story.userId },
              { blockerId: story.userId, blockedId: request.user.sub }
            ]
          },
          select: { blockerId: true }
        })
      ]);

      if (!follow || block) {
        throw reply.notFound("Story not found");
      }
    }

    await app.prisma.storyView.upsert({
      where: {
        storyId_viewerId: {
          storyId: id,
          viewerId: request.user.sub
        }
      },
      update: { viewedAt: new Date() },
      create: {
        storyId: id,
        viewerId: request.user.sub
      }
    });

    return {
      ...story,
      viewed: true,
      ringState: "seen"
    };
  });
};
