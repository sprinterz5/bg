import { MediaModerationProvider, MediaModerationStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

type ModerationDecision = {
  status: MediaModerationStatus;
  score?: number;
  reason: string;
  rawJson?: unknown;
};

function configuredProvider() {
  return env.MEDIA_MODERATION_PROVIDER as MediaModerationProvider;
}

export function mediaModerationReadiness() {
  const provider = configuredProvider();
  return {
    enabled: provider !== "DISABLED",
    provider,
    defaultStatus: env.MEDIA_MODERATION_DEFAULT_STATUS,
    reviewThreshold: env.MEDIA_MODERATION_REVIEW_THRESHOLD,
    rejectThreshold: env.MEDIA_MODERATION_REJECT_THRESHOLD,
    ready: provider === "DISABLED" || provider === "LOCAL_STUB",
    missing: provider === "DISABLED" || provider === "LOCAL_STUB" ? [] : ["provider_credentials"]
  };
}

function disabledDecision(): ModerationDecision {
  return {
    status: env.MEDIA_MODERATION_DEFAULT_STATUS as MediaModerationStatus,
    score: 0,
    reason: "media_moderation_disabled"
  };
}

function localStubDecision(): ModerationDecision {
  return {
    status: "PENDING",
    score: 0.5,
    reason: "local_stub_requires_review"
  };
}

export async function moderateMediaAsset(app: FastifyInstance, mediaId: string): Promise<ModerationDecision> {
  const provider = configuredProvider();
  const media = await app.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!media) {
    throw new Error("Media asset not found");
  }

  const decision =
    provider === "DISABLED"
      ? disabledDecision()
      : provider === "LOCAL_STUB"
        ? localStubDecision()
        : {
            status: "PENDING" as const,
            reason: `${provider.toLowerCase()}_provider_not_configured`,
            rawJson: { provider, storageKey: media.storageKey }
          };

  await app.prisma.mediaAsset.update({
    where: { id: mediaId },
    data: {
      moderationStatus: decision.status,
      moderationProvider: provider,
      moderationScore: decision.score,
      moderationReason: decision.reason,
      moderatedAt: decision.status === "PENDING" ? null : new Date()
    }
  });

  await app.prisma.mediaModerationEvent.create({
    data: {
      mediaId,
      provider,
      status: decision.status,
      score: decision.score,
      reason: decision.reason,
      rawJson: decision.rawJson as any
    }
  });

  return decision;
}

export async function runMediaModerationJob(app: FastifyInstance, options: { limit?: number } = {}) {
  const limit = options.limit ?? 100;
  const rows = await app.prisma.mediaAsset.findMany({
    where: { moderationStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true }
  });

  let processed = 0;
  let approved = 0;
  let flagged = 0;
  let rejected = 0;
  const errors: Array<{ mediaId: string; error: string }> = [];

  for (const row of rows) {
    try {
      const decision = await moderateMediaAsset(app, row.id);
      processed += 1;
      if (decision.status === "APPROVED") approved += 1;
      if (decision.status === "FLAGGED") flagged += 1;
      if (decision.status === "REJECTED") rejected += 1;
    } catch (error) {
      errors.push({ mediaId: row.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    ...mediaModerationReadiness(),
    scanned: rows.length,
    processed,
    approved,
    flagged,
    rejected,
    failed: errors.length,
    errors: errors.slice(0, 20)
  };
}

export async function setMediaModerationStatus(
  app: FastifyInstance,
  input: {
    mediaId: string;
    status: MediaModerationStatus;
    moderatorId: string;
    reason?: string;
    score?: number;
  }
) {
  const provider = configuredProvider();
  const updated = await app.prisma.mediaAsset.update({
    where: { id: input.mediaId },
    data: {
      moderationStatus: input.status,
      moderationProvider: provider,
      moderationScore: input.score,
      moderationReason: input.reason,
      moderatedAt: new Date()
    }
  });

  await app.prisma.mediaModerationEvent.create({
    data: {
      mediaId: input.mediaId,
      provider,
      status: input.status,
      score: input.score,
      reason: input.reason,
      moderatorId: input.moderatorId
    }
  });

  return updated;
}
