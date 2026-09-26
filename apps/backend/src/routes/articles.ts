import { ArticleStatus, ModerationAction } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { readingTimeMinutes } from "../utils/readingTime.js";
import { makeSlug } from "../utils/slug.js";
import { getPagination, pageResult, takePlusOne } from "../utils/pagination.js";

const articleCreateSchema = z.object({
  // Explore cards show the title and excerpt in 2 lines each without truncation.
  title: z.string().min(1).max(55),
  subtitle: z.string().max(240).optional(),
  excerpt: z.string().max(90).optional(),
  body: z.string().min(1),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([])
});

// `status` is intentionally excluded — state transitions go through /publish
// and /unpublish endpoints so they always produce a ModerationEvent.
const articleUpdateSchema = articleCreateSchema.partial();

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export const articleRoutes: FastifyPluginAsync = async (app) => {
  app.post("/articles", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = articleCreateSchema.parse(request.body);
    const article = await app.prisma.article.create({
      data: {
        authorId: request.user.sub,
        title: body.title,
        slug: makeSlug(body.title),
        subtitle: body.subtitle,
        excerpt: body.excerpt,
        body: body.body,
        coverImageUrl: body.coverImageUrl,
        tags: body.tags,
        readingTimeMinutes: readingTimeMinutes(body.body)
      }
    });

    return reply.status(201).send(article);
  });

  app.get("/me/articles", { preHandler: [app.authenticate] }, async (request) => {
    const { limit, cursor } = getPagination(request.query);
    const articles = await app.prisma.article.findMany({
      where: { authorId: request.user.sub, deletedAt: null },
      take: takePlusOne(limit),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "desc" }
    });

    return pageResult(articles, limit);
  });

  app.get("/articles", async (request) => {
    const { limit, cursor } = getPagination(request.query);
    const articles = await app.prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        moderationStatus: "APPROVED",
        deletedAt: null
      },
      take: takePlusOne(limit),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { publishedAt: "desc" },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });

    return pageResult(articles, limit);
  });

  app.get("/articles/:idOrSlug", async (request, reply) => {
    const { idOrSlug } = z.object({ idOrSlug: z.string().min(1) }).parse(request.params);
    const article = await app.prisma.article.findFirst({
      where: isUuid(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });

    if (!article || article.deletedAt) {
      throw reply.notFound("Article not found");
    }

    if (article.status !== "PUBLISHED" || article.moderationStatus !== "APPROVED") {
      throw reply.notFound("Article not found");
    }

    return article;
  });

  app.patch("/articles/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = articleUpdateSchema.parse(request.body);
    const article = await app.prisma.article.findUnique({ where: { id } });
    if (!article || article.authorId !== request.user.sub) {
      throw reply.notFound("Article not found");
    }

    // Any change to a user-visible field on a published article must re-enter
    // the moderation queue — prevents bait-and-switch after initial approval.
    const visibleFieldChanged =
      body.title !== undefined ||
      body.subtitle !== undefined ||
      body.excerpt !== undefined ||
      body.body !== undefined ||
      body.coverImageUrl !== undefined ||
      body.tags !== undefined;

    const updated = await app.prisma.article.update({
      where: { id },
      data: {
        ...body,
        ...(body.title ? { slug: makeSlug(body.title) } : {}),
        ...(body.body ? { readingTimeMinutes: readingTimeMinutes(body.body) } : {}),
        ...(visibleFieldChanged && article.status === "PUBLISHED" ? { moderationStatus: "PENDING" } : {})
      }
    });

    return updated;
  });

  app.post("/articles/:id/publish", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const article = await app.prisma.article.findUnique({ where: { id } });
    if (!article || article.authorId !== request.user.sub) {
      throw reply.notFound("Article not found");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const published = await tx.article.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          moderationStatus: "PENDING",
          publishedAt: article.publishedAt ?? new Date()
        }
      });

      await tx.moderationEvent.create({
        data: {
          targetType: "ARTICLE",
          targetId: id,
          action: ModerationAction.SUBMITTED
        }
      });

      return published;
    });

    return updated;
  });

  app.delete("/articles/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const article = await app.prisma.article.findUnique({ where: { id } });
    if (!article || article.authorId !== request.user.sub) {
      throw reply.notFound("Article not found");
    }

    await app.prisma.article.update({
      where: { id },
      data: {
        status: "ARCHIVED",
        deletedAt: new Date()
      }
    });

    return { ok: true };
  });
};
