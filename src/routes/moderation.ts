import { ModerationAction, UserRole } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const moderationParamsSchema = z.object({
  targetType: z.enum(["ARTICLE", "REVIEW"]),
  targetId: z.string().uuid()
});

const moderationBodySchema = z.object({
  reason: z.string().max(2000).optional(),
  score: z.number().optional()
});

function baseExploreScore(content: { readingTimeMinutes: number; publishedAt: Date | null; createdAt: Date }) {
  const publishedAt = content.publishedAt ?? content.createdAt;
  const ageHours = Math.max(1, (Date.now() - publishedAt.getTime()) / 36e5);
  return Math.max(1, 20 - ageHours / 12) + Math.min(5, content.readingTimeMinutes / 2);
}

export const moderationRoutes: FastifyPluginAsync = async (app) => {
  const moderatorOnly = app.requireRole([UserRole.MODERATOR, UserRole.ADMIN]);

  app.get("/moderation/queue", { preHandler: [moderatorOnly] }, async () => {
    const [articles, reviews] = await Promise.all([
      app.prisma.article.findMany({
        where: {
          status: "PUBLISHED",
          moderationStatus: "PENDING",
          deletedAt: null
        },
        orderBy: { publishedAt: "asc" },
        include: { author: { select: { id: true, username: true, displayName: true } } }
      }),
      app.prisma.review.findMany({
        where: {
          status: "PUBLISHED",
          moderationStatus: "PENDING",
          deletedAt: null
        },
        orderBy: { publishedAt: "asc" },
        include: {
          author: { select: { id: true, username: true, displayName: true } },
          book: true
        }
      })
    ]);

    return {
      articles,
      reviews
    };
  });

  app.post("/moderation/:targetType/:targetId/approve", { preHandler: [moderatorOnly] }, async (request, reply) => {
    const params = moderationParamsSchema.parse(request.params);
    const body = moderationBodySchema.parse(request.body ?? {});

    const result = await app.prisma.$transaction(async (tx) => {
      if (params.targetType === "ARTICLE") {
        const article = await tx.article.update({
          where: { id: params.targetId },
          data: {
            moderationStatus: "APPROVED",
            moderationReason: body.reason
          }
        });

        await tx.exploreItem.upsert({
          where: {
            targetType_targetId: {
              targetType: "ARTICLE",
              targetId: article.id
            }
          },
          update: {
            moderationStatus: "APPROVED",
            score: body.score ?? baseExploreScore(article),
            reason: body.reason
          },
          create: {
            targetType: "ARTICLE",
            targetId: article.id,
            moderationStatus: "APPROVED",
            score: body.score ?? baseExploreScore(article),
            reason: body.reason
          }
        });

        return article;
      }

      const review = await tx.review.update({
        where: { id: params.targetId },
        data: {
          moderationStatus: "APPROVED",
          moderationReason: body.reason
        }
      });

      await tx.exploreItem.upsert({
        where: {
          targetType_targetId: {
            targetType: "REVIEW",
            targetId: review.id
          }
        },
        update: {
          moderationStatus: "APPROVED",
          score: body.score ?? baseExploreScore(review),
          reason: body.reason
        },
        create: {
          targetType: "REVIEW",
          targetId: review.id,
          moderationStatus: "APPROVED",
          score: body.score ?? baseExploreScore(review),
          reason: body.reason
        }
      });

      return review;
    }).catch((error) => {
      app.log.error(error);
      return null;
    });

    if (!result) {
      throw reply.notFound("Content not found");
    }

    await app.prisma.moderationEvent.create({
      data: {
        targetType: params.targetType,
        targetId: params.targetId,
        action: ModerationAction.APPROVED,
        reason: body.reason,
        moderatorId: request.user.sub
      }
    });

    return result;
  });

  app.post("/moderation/:targetType/:targetId/reject", { preHandler: [moderatorOnly] }, async (request, reply) => {
    const params = moderationParamsSchema.parse(request.params);
    const body = moderationBodySchema.parse(request.body ?? {});

    if (params.targetType === "ARTICLE") {
      await app.prisma.article.update({
        where: { id: params.targetId },
        data: {
          moderationStatus: "REJECTED",
          moderationReason: body.reason
        }
      }).catch(() => null);
    } else {
      await app.prisma.review.update({
        where: { id: params.targetId },
        data: {
          moderationStatus: "REJECTED",
          moderationReason: body.reason
        }
      }).catch(() => null);
    }

    await app.prisma.exploreItem.upsert({
      where: {
        targetType_targetId: {
          targetType: params.targetType,
          targetId: params.targetId
        }
      },
      update: {
        moderationStatus: "REJECTED",
        reason: body.reason
      },
      create: {
        targetType: params.targetType,
        targetId: params.targetId,
        moderationStatus: "REJECTED",
        reason: body.reason
      }
    });

    await app.prisma.moderationEvent.create({
      data: {
        targetType: params.targetType,
        targetId: params.targetId,
        action: ModerationAction.REJECTED,
        reason: body.reason,
        moderatorId: request.user.sub
      }
    });

    return { ok: true };
  });
};
