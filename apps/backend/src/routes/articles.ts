import { ArticleStatus, ModerationAction } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { readingTimeMinutes } from "../utils/readingTime.js";
import { makeSlug } from "../utils/slug.js";
import { getPagination, pageResult, takePlusOne } from "../utils/pagination.js";
import { withIdempotency } from "../services/idempotencyService.js";
import { endpointRateLimit } from "../services/rateLimitService.js";
import { asApi, type ApiArticle, type ApiArticleCreated } from "../contracts/api.js";
import { env } from "../config/env.js";

// Without moderators a published article is approved at once (env ARTICLES_AUTO_APPROVE).
const publishedModeration = () =>
  env.ARTICLES_AUTO_APPROVE
    ? { moderationStatus: "APPROVED" as const, action: ModerationAction.APPROVED }
    : { moderationStatus: "PENDING" as const, action: ModerationAction.SUBMITTED };

const articleCreateSchema = z.object({
  // The app measures titles against the Explore card (2 lines); this is only a hard cap.
  title: z.string().min(1).max(80),
  subtitle: z.string().max(240).optional(),
  excerpt: z.string().max(600).optional(),
  body: z.string().min(1),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([])
});

// The app's "Post": created and published in one call, so a retried request (Idempotency-Key) can't leave a draft.
const articlePostSchema = articleCreateSchema.extend({ publish: z.boolean().default(false) });

// `status` is intentionally excluded — state transitions go through /publish
// and /unpublish endpoints so they always produce a ModerationEvent.
const articleUpdateSchema = articleCreateSchema.partial();

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export const articleRoutes: FastifyPluginAsync = async (app) => {
  const postLimit = endpointRateLimit({ key: "articles-create", limit: 20, windowSeconds: 3600, by: "userOrIp" });
  app.post("/articles", { preHandler: [app.authenticate, postLimit] }, async (request, reply) => {
    const result = await withIdempotency(request, reply, async () => {
      const { publish, ...body } = articlePostSchema.parse(request.body);
      const article = await app.prisma.$transaction(async (tx) => {
        const created = await tx.article.create({
          data: {
            authorId: request.user.sub,
            title: body.title,
            slug: makeSlug(body.title),
            subtitle: body.subtitle,
            excerpt: body.excerpt,
            body: body.body,
            coverImageUrl: body.coverImageUrl,
            tags: body.tags,
            readingTimeMinutes: readingTimeMinutes(body.body),
            ...(publish ? { status: "PUBLISHED" as const, moderationStatus: publishedModeration().moderationStatus, publishedAt: new Date() } : {})
          }
        });
        if (publish) {
          await tx.moderationEvent.create({ data: { targetType: "ARTICLE", targetId: created.id, action: publishedModeration().action } });
        }
        return created;
      });
      return { statusCode: 201, body: asApi<ApiArticleCreated>(article) };
    });
    return reply.status(result.statusCode ?? 201).send(result.body);
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

    return asApi<ApiArticle>(article);
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
          moderationStatus: publishedModeration().moderationStatus,
          publishedAt: article.publishedAt ?? new Date()
        }
      });

      await tx.moderationEvent.create({
        data: {
          targetType: "ARTICLE",
          targetId: id,
          action: publishedModeration().action
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
