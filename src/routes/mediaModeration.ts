import { MediaModerationStatus, UserRole } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { mediaModerationReadiness, runMediaModerationJob, setMediaModerationStatus } from "../services/mediaModerationService.js";
import { runTrackedJob } from "../services/jobRunService.js";

const mediaQueueSchema = z.object({
  status: z.nativeEnum(MediaModerationStatus).default("PENDING"),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

const mediaDecisionSchema = z.object({
  status: z.enum(["APPROVED", "FLAGGED", "REJECTED"]),
  reason: z.string().max(2000).optional(),
  score: z.number().min(0).max(1).optional()
});

const mediaJobSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

export const mediaModerationRoutes: FastifyPluginAsync = async (app) => {
  const moderatorOnly = app.requireRole([UserRole.MODERATOR, UserRole.ADMIN]);

  app.get("/media/moderation/readiness", { preHandler: [moderatorOnly] }, async () => {
    return mediaModerationReadiness();
  });

  app.get("/media/moderation/queue", { preHandler: [moderatorOnly] }, async (request) => {
    const query = mediaQueueSchema.parse(request.query);
    const rows = await app.prisma.mediaAsset.findMany({
      where: { moderationStatus: query.status },
      orderBy: { createdAt: "asc" },
      take: query.limit,
      include: {
        owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        variants: true
      }
    });
    return { data: rows };
  });

  app.patch("/media/:id/moderation", { preHandler: [moderatorOnly] }, async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = mediaDecisionSchema.parse(request.body ?? {});
    return setMediaModerationStatus(app, {
      mediaId: id,
      status: body.status,
      reason: body.reason,
      score: body.score,
      moderatorId: request.user.sub
    });
  });

  app.post("/media/moderation/jobs/scan", { preHandler: [moderatorOnly] }, async (request) => {
    const body = mediaJobSchema.parse(request.body ?? {});
    return runTrackedJob(app.prisma, {
      name: "media-moderation",
      payload: { ...body, source: "media_moderation_endpoint", userId: request.user.sub },
      fn: () => runMediaModerationJob(app, body)
    });
  });
};
