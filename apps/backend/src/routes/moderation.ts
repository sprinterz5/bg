import { ModerationAction, UserRole } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createNotification } from "../services/notificationService.js";
import { runCleanupJobs } from "../services/cleanupService.js";
import { runMaintenanceJobs } from "../services/maintenanceService.js";
import { runSpamScoringJob } from "../services/spamScoringService.js";
import { runTrackedJob } from "../services/jobRunService.js";

const moderationParamsSchema = z.object({
  targetType: z.enum(["ARTICLE", "REVIEW"]),
  targetId: z.string().uuid()
});

const moderationBodySchema = z.object({
  reason: z.string().max(2000).optional(),
  score: z.number().optional()
});

const spamScoreJobSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  threshold: z.coerce.number().min(1).max(100).default(70)
});

const maintenanceJobSchema = z.object({
  bookLimit: z.coerce.number().int().min(1).max(500).default(50)
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

    const reports = await app.prisma.report.findMany({
      where: {
        status: { in: ["OPEN", "UNDER_REVIEW"] }
      },
      orderBy: { createdAt: "asc" },
      include: {
        reporter: { select: { id: true, username: true, displayName: true } }
      }
    });

    return {
      articles,
      reviews,
      reports
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

    if (params.targetType === "ARTICLE" && "authorId" in result) {
      await createNotification(app, {
        userId: result.authorId,
        type: "MODERATION_APPROVED",
        targetType: "ARTICLE",
        targetId: result.id,
        title: "Article approved",
        body: "Your article was approved and can now appear in feeds and Explore."
      });
    }

    if (params.targetType === "REVIEW" && "authorId" in result) {
      await createNotification(app, {
        userId: result.authorId,
        type: "MODERATION_APPROVED",
        targetType: "REVIEW",
        targetId: result.id,
        title: "Review approved",
        body: "Your review was approved and can now appear in feeds and Explore."
      });
    }

    return result;
  });

  app.post("/moderation/:targetType/:targetId/reject", { preHandler: [moderatorOnly] }, async (request, reply) => {
    const params = moderationParamsSchema.parse(request.params);
    const body = moderationBodySchema.parse(request.body ?? {});

    let rejectedAuthorId: string | null = null;
    if (params.targetType === "ARTICLE") {
      const rejected = await app.prisma.article.update({
        where: { id: params.targetId },
        data: {
          moderationStatus: "REJECTED",
          moderationReason: body.reason
        }
      }).catch(() => null);
      rejectedAuthorId = rejected?.authorId ?? null;
    } else {
      const rejected = await app.prisma.review.update({
        where: { id: params.targetId },
        data: {
          moderationStatus: "REJECTED",
          moderationReason: body.reason
        }
      }).catch(() => null);
      rejectedAuthorId = rejected?.authorId ?? null;
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

    if (rejectedAuthorId) {
      await createNotification(app, {
        userId: rejectedAuthorId,
        type: "MODERATION_REJECTED",
        targetType: params.targetType,
        targetId: params.targetId,
        title: params.targetType === "ARTICLE" ? "Article needs changes" : "Review needs changes",
        body: body.reason ?? "Your content did not pass moderation.",
        data: { reason: body.reason }
      });
    }

    return { ok: true };
  });

  app.post("/moderation/jobs/spam-score", { preHandler: [moderatorOnly] }, async (request) => {
    const body = spamScoreJobSchema.parse(request.body ?? {});
    return runTrackedJob(app.prisma, {
      name: "spam-score",
      payload: { ...body, source: "moderation_endpoint", userId: request.user.sub },
      fn: () => runSpamScoringJob(app.prisma, body)
    });
  });

  app.post("/moderation/jobs/maintenance", { preHandler: [moderatorOnly] }, async (request) => {
    const body = maintenanceJobSchema.parse(request.body ?? {});
    return runTrackedJob(app.prisma, {
      name: "maintenance",
      payload: { ...body, source: "moderation_endpoint", userId: request.user.sub },
      fn: () => runMaintenanceJobs(app, body)
    });
  });

  app.post("/moderation/jobs/cleanup", { preHandler: [moderatorOnly] }, async (request) => {
    return runTrackedJob(app.prisma, {
      name: "cleanup",
      payload: { source: "moderation_endpoint", userId: request.user.sub },
      fn: () => runCleanupJobs(app)
    });
  });
};
