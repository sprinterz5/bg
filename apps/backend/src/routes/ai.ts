import { AiEmbeddingTargetType, UserRole } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { aiReadiness } from "../services/aiProviderService.js";
import { getAiEmbeddingStats, runAiEmbeddingBackfill } from "../services/aiEmbeddingService.js";
import { runTrackedJob } from "../services/jobRunService.js";

const embeddingJobSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  targetTypes: z.array(z.nativeEnum(AiEmbeddingTargetType)).min(1).max(3).optional()
});

const embeddingListSchema = z.object({
  targetType: z.nativeEnum(AiEmbeddingTargetType).optional(),
  status: z.enum(["PENDING", "READY", "FAILED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export const aiRoutes: FastifyPluginAsync = async (app) => {
  const adminOrModerator = app.requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  app.get("/ai/readiness", { preHandler: [adminOrModerator] }, async () => {
    const stats = await getAiEmbeddingStats(app);
    return {
      ...aiReadiness(),
      embeddings: stats
    };
  });

  app.get("/ai/embeddings", { preHandler: [adminOrModerator] }, async (request) => {
    const query = embeddingListSchema.parse(request.query);
    const rows = await app.prisma.aiEmbedding.findMany({
      where: {
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      orderBy: { updatedAt: "desc" },
      take: query.limit,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        provider: true,
        model: true,
        dimensions: true,
        inputHash: true,
        textPreview: true,
        status: true,
        error: true,
        embeddedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return { data: rows };
  });

  app.post("/ai/jobs/embeddings", { preHandler: [adminOrModerator] }, async (request) => {
    const body = embeddingJobSchema.parse(request.body ?? {});
    return runTrackedJob(app.prisma, {
      name: "ai-embedding-backfill",
      payload: { ...body, source: "ai_endpoint", userId: request.user.sub },
      fn: () => runAiEmbeddingBackfill(app, body)
    });
  });
};
