import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  getBookByIsbn,
  getGoogleBookById,
  getOpenLibraryBook,
  searchBookCandidates,
  upsertBook
} from "../services/bookService.js";
import { getSimilarBooks, recomputeSimilarBooks } from "../services/bookSimilarityService.js";

const searchSchema = z.object({
  q: z.string().min(1).max(200)
});

const importSchema = z
  .object({
    googleBooksId: z.string().optional(),
    openLibraryKey: z.string().optional(),
    isbn: z.string().optional()
  })
  .refine((value) => value.googleBooksId || value.openLibraryKey || value.isbn, {
    message: "googleBooksId, openLibraryKey, or isbn is required"
  });

export const bookRoutes: FastifyPluginAsync = async (app) => {
  app.get("/books/search", async (request) => {
    const { q } = searchSchema.parse(request.query);
    const data = await searchBookCandidates(q);
    return { data };
  });

  app.post("/books/import", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = importSchema.parse(request.body);
    const candidate = body.googleBooksId
      ? await getGoogleBookById(body.googleBooksId)
      : body.openLibraryKey
        ? await getOpenLibraryBook(body.openLibraryKey)
        : await getBookByIsbn(body.isbn ?? "");

    if (!candidate) {
      throw reply.notFound("Book not found in external sources");
    }

    const book = await upsertBook(app, candidate);
    return reply.status(201).send(book);
  });

  app.get("/books/:id/similar", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) }).parse(request.query);
    const book = await app.prisma.book.findUnique({ where: { id }, select: { id: true } });
    if (!book) {
      throw reply.notFound("Book not found");
    }

    const data = await getSimilarBooks(app, id, limit);
    return { data: data ?? [] };
  });

  app.post("/books/:id/similar/recompute", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(25) }).parse(request.query);
    const data = await recomputeSimilarBooks(app, id, limit);
    if (!data) {
      throw reply.notFound("Book not found");
    }

    return { data };
  });

  app.get("/books/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const book = await app.prisma.book.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            shelfItems: true,
            reviews: true
          }
        }
      }
    });

    if (!book) {
      throw reply.notFound("Book not found");
    }

    return book;
  });
};
