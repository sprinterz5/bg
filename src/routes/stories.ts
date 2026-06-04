import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

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
  app.post("/stories", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = storyCreateSchema.parse(request.body);

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

    return reply.status(201).send(story);
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
    const follows = await app.prisma.follow.findMany({
      where: { followerId: request.user.sub },
      select: { followingId: true }
    });

    const stories = await app.prisma.story.findMany({
      where: {
        userId: { in: follows.map((follow) => follow.followingId) },
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
      return {
        id: story.id,
        user: story.user,
        mediaUrl: story.mediaUrl,
        mediaMimeType: story.mediaMimeType,
        caption: viewed ? story.caption : null,
        book: viewed ? story.book : null,
        viewed,
        ringState: viewed ? "seen" : "unseen",
        createdAt: story.createdAt,
        expiresAt: story.expiresAt
      };
    });
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
