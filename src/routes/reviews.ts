import { ModerationAction, ReviewStatus } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPagination, pageResult, takePlusOne } from "../utils/pagination.js";
import { readingTimeMinutes } from "../utils/readingTime.js";

const reviewCreateSchema = z.object({
  bookId: z.string().uuid(),
  title: z.string().min(1).max(180),
  body: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([])
});

const reviewUpdateSchema = reviewCreateSchema.partial().extend({
  status: z.nativeEnum(ReviewStatus).optional()
});

export const reviewRoutes: FastifyPluginAsync = async (app) => {
  app.post("/reviews", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = reviewCreateSchema.parse(request.body);
    const book = await app.prisma.book.findUnique({ where: { id: body.bookId } });
    if (!book) {
      throw reply.notFound("Book not found");
    }

    const review = await app.prisma.review.create({
      data: {
        authorId: request.user.sub,
        bookId: body.bookId,
        title: body.title,
        body: body.body,
        rating: body.rating,
        tags: body.tags,
        readingTimeMinutes: readingTimeMinutes(body.body)
      },
      include: { book: true }
    });

    return reply.status(201).send(review);
  });

  app.get("/me/reviews", { preHandler: [app.authenticate] }, async (request) => {
    const { limit, cursor } = getPagination(request.query);
    const reviews = await app.prisma.review.findMany({
      where: { authorId: request.user.sub, deletedAt: null },
      take: takePlusOne(limit),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "desc" },
      include: { book: true }
    });

    return pageResult(reviews, limit);
  });

  app.get("/reviews", async (request) => {
    const query = z
      .object({
        bookId: z.string().uuid().optional()
      })
      .merge(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.string().optional() }))
      .parse(request.query);

    const reviews = await app.prisma.review.findMany({
      where: {
        ...(query.bookId ? { bookId: query.bookId } : {}),
        status: "PUBLISHED",
        moderationStatus: "APPROVED",
        deletedAt: null
      },
      take: takePlusOne(query.limit),
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { publishedAt: "desc" },
      include: {
        book: true,
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });

    return pageResult(reviews, query.limit);
  });

  app.get("/reviews/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const review = await app.prisma.review.findUnique({
      where: { id },
      include: {
        book: true,
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });

    if (!review || review.deletedAt || review.status !== "PUBLISHED" || review.moderationStatus !== "APPROVED") {
      throw reply.notFound("Review not found");
    }

    return review;
  });

  app.patch("/reviews/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = reviewUpdateSchema.parse(request.body);
    const review = await app.prisma.review.findUnique({ where: { id } });
    if (!review || review.authorId !== request.user.sub) {
      throw reply.notFound("Review not found");
    }

    return app.prisma.review.update({
      where: { id },
      data: {
        ...body,
        ...(body.body
          ? {
              readingTimeMinutes: readingTimeMinutes(body.body),
              moderationStatus: review.status === "PUBLISHED" ? "PENDING" : review.moderationStatus
            }
          : {})
      },
      include: { book: true }
    });
  });

  app.post("/reviews/:id/publish", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const review = await app.prisma.review.findUnique({ where: { id } });
    if (!review || review.authorId !== request.user.sub) {
      throw reply.notFound("Review not found");
    }

    return app.prisma.$transaction(async (tx) => {
      const published = await tx.review.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          moderationStatus: "PENDING",
          publishedAt: review.publishedAt ?? new Date()
        },
        include: { book: true }
      });

      await tx.moderationEvent.create({
        data: {
          targetType: "REVIEW",
          targetId: id,
          action: ModerationAction.SUBMITTED
        }
      });

      return published;
    });
  });

  app.delete("/reviews/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const review = await app.prisma.review.findUnique({ where: { id } });
    if (!review || review.authorId !== request.user.sub) {
      throw reply.notFound("Review not found");
    }

    await app.prisma.review.update({
      where: { id },
      data: {
        status: "ARCHIVED",
        deletedAt: new Date()
      }
    });

    return { ok: true };
  });
};
