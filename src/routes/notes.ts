import { NoteTargetType } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPagination, pageResult, takePlusOne } from "../utils/pagination.js";

const noteCreateSchema = z.object({
  targetType: z.nativeEnum(NoteTargetType),
  targetId: z.string().uuid(),
  selectedText: z.string().min(1).max(4000),
  noteText: z.string().min(1).max(8000),
  anchorStart: z.number().int().min(0).optional(),
  anchorEnd: z.number().int().min(0).optional()
});

const noteUpdateSchema = z.object({
  noteText: z.string().min(1).max(8000),
  selectedText: z.string().min(1).max(4000).optional(),
  anchorStart: z.number().int().min(0).nullable().optional(),
  anchorEnd: z.number().int().min(0).nullable().optional()
});

export const noteRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me/notes", { preHandler: [app.authenticate] }, async (request) => {
    const { limit, cursor } = getPagination(request.query);
    const notes = await app.prisma.note.findMany({
      where: { userId: request.user.sub },
      take: takePlusOne(limit),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        article: { select: { id: true, title: true, slug: true, coverImageUrl: true } },
        review: { select: { id: true, title: true, book: true } }
      }
    });

    return pageResult(notes, limit);
  });

  app.post("/notes", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = noteCreateSchema.parse(request.body);

    if (body.targetType === "ARTICLE") {
      const article = await app.prisma.article.findFirst({
        where: {
          id: body.targetId,
          status: "PUBLISHED",
          moderationStatus: "APPROVED",
          deletedAt: null
        }
      });
      if (!article) {
        throw reply.notFound("Article not found");
      }
    } else {
      const review = await app.prisma.review.findFirst({
        where: {
          id: body.targetId,
          status: "PUBLISHED",
          moderationStatus: "APPROVED",
          deletedAt: null
        }
      });
      if (!review) {
        throw reply.notFound("Review not found");
      }
    }

    const note = await app.prisma.note.create({
      data: {
        userId: request.user.sub,
        targetType: body.targetType,
        articleId: body.targetType === "ARTICLE" ? body.targetId : undefined,
        reviewId: body.targetType === "REVIEW" ? body.targetId : undefined,
        selectedText: body.selectedText,
        noteText: body.noteText,
        anchorStart: body.anchorStart,
        anchorEnd: body.anchorEnd
      }
    });

    return reply.status(201).send(note);
  });

  app.patch("/notes/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = noteUpdateSchema.parse(request.body);
    const note = await app.prisma.note.findUnique({ where: { id } });
    if (!note || note.userId !== request.user.sub) {
      throw reply.notFound("Note not found");
    }

    return app.prisma.note.update({
      where: { id },
      data: body
    });
  });

  app.delete("/notes/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const note = await app.prisma.note.findUnique({ where: { id } });
    if (!note || note.userId !== request.user.sub) {
      throw reply.notFound("Note not found");
    }

    await app.prisma.note.delete({ where: { id } });
    return { ok: true };
  });
};
