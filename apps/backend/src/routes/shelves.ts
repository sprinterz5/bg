import { ShelfStatus } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const shelfQuerySchema = z.object({
  status: z.nativeEnum(ShelfStatus).optional()
});

const shelfBodySchema = z.object({
  status: z.nativeEnum(ShelfStatus),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  progressPage: z.number().int().min(0).nullable().optional(),
  progressPercent: z.number().int().min(0).max(100).nullable().optional(),
  privateNote: z.string().max(5000).nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  finishedAt: z.coerce.date().nullable().optional()
});

export const shelfRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me/shelves", { preHandler: [app.authenticate] }, async (request) => {
    const { status } = shelfQuerySchema.parse(request.query);
    return app.prisma.shelfItem.findMany({
      where: {
        userId: request.user.sub,
        ...(status ? { status } : {})
      },
      orderBy: { updatedAt: "desc" },
      include: { book: true }
    });
  });

  app.put("/me/shelves/:bookId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { bookId } = z.object({ bookId: z.string().uuid() }).parse(request.params);
    const body = shelfBodySchema.parse(request.body);
    const book = await app.prisma.book.findUnique({ where: { id: bookId } });
    if (!book) {
      throw reply.notFound("Book not found");
    }

    const item = await app.prisma.shelfItem.upsert({
      where: {
        userId_bookId: {
          userId: request.user.sub,
          bookId
        }
      },
      create: {
        userId: request.user.sub,
        bookId,
        ...body
      },
      update: body,
      include: { book: true }
    });

    return item;
  });

  app.delete("/me/shelves/:bookId", { preHandler: [app.authenticate] }, async (request) => {
    const { bookId } = z.object({ bookId: z.string().uuid() }).parse(request.params);
    await app.prisma.shelfItem.deleteMany({
      where: {
        userId: request.user.sub,
        bookId
      }
    });

    return { ok: true };
  });
};
