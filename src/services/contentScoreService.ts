import type { ContentScoreTargetType, FeedEventTargetType, FeedEventType } from "@prisma/client";
import type { FastifyInstance } from "fastify";

type ScoreDelta = {
  impressions?: number;
  opens?: number;
  completions?: number;
  totalDwellMs?: number;
  likes?: number;
  saves?: number;
  hides?: number;
  shares?: number;
  comments?: number;
  reports?: number;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toContentTarget(targetType: FeedEventTargetType | string): ContentScoreTargetType | null {
  return targetType === "ARTICLE" || targetType === "REVIEW" ? targetType : null;
}

function scoreFromStats(stats: {
  impressions: number;
  opens: number;
  completions: number;
  totalDwellMs: bigint | number;
  likes: number;
  saves: number;
  hides: number;
  shares: number;
  comments: number;
  reports: number;
}) {
  const impressions = Math.max(stats.impressions, 1);
  const opens = Math.max(stats.opens, 1);
  const totalDwellMs = Number(stats.totalDwellMs);
  const openRate = stats.opens / impressions;
  const completionRate = stats.completions / opens;
  const likeRate = stats.likes / impressions;
  const saveRate = stats.saves / impressions;
  const hideRate = stats.hides / impressions;
  const reportRate = stats.reports / impressions;
  const avgDwellSeconds = totalDwellMs / opens / 1000;

  const spamScore = clamp(reportRate * 240 + hideRate * 120);
  const engagementScore = clamp(
    openRate * 24 +
      completionRate * 28 +
      likeRate * 130 +
      saveRate * 160 +
      (stats.comments / impressions) * 80 +
      (stats.shares / impressions) * 90 -
      spamScore * 0.35
  );
  const qualityScore = clamp(
    35 +
      completionRate * 25 +
      clamp(avgDwellSeconds / 180, 0, 1) * 18 +
      likeRate * 80 +
      saveRate * 90 -
      spamScore * 0.45
  );
  const trendingScore = clamp(
    engagementScore * 0.55 +
      qualityScore * 0.3 +
      Math.log1p(stats.opens + stats.likes + stats.saves + stats.comments) * 8 -
      stats.reports * 8
  );

  return { spamScore, engagementScore, qualityScore, trendingScore };
}

export async function incrementContentScore(
  app: FastifyInstance,
  targetType: string,
  targetId: string,
  delta: ScoreDelta
) {
  const contentTarget = toContentTarget(targetType);
  if (!contentTarget) {
    return null;
  }

  const create = {
    targetType: contentTarget,
    targetId,
    impressions: delta.impressions ?? 0,
    opens: delta.opens ?? 0,
    completions: delta.completions ?? 0,
    totalDwellMs: BigInt(delta.totalDwellMs ?? 0),
    likes: delta.likes ?? 0,
    saves: delta.saves ?? 0,
    hides: delta.hides ?? 0,
    shares: delta.shares ?? 0,
    comments: delta.comments ?? 0,
    reports: delta.reports ?? 0
  };

  const stats = await app.prisma.contentScore.upsert({
    where: {
      targetType_targetId: {
        targetType: contentTarget,
        targetId
      }
    },
    create,
    update: {
      ...(delta.impressions ? { impressions: { increment: delta.impressions } } : {}),
      ...(delta.opens ? { opens: { increment: delta.opens } } : {}),
      ...(delta.completions ? { completions: { increment: delta.completions } } : {}),
      ...(delta.totalDwellMs ? { totalDwellMs: { increment: BigInt(delta.totalDwellMs) } } : {}),
      ...(delta.likes ? { likes: { increment: delta.likes } } : {}),
      ...(delta.saves ? { saves: { increment: delta.saves } } : {}),
      ...(delta.hides ? { hides: { increment: delta.hides } } : {}),
      ...(delta.shares ? { shares: { increment: delta.shares } } : {}),
      ...(delta.comments ? { comments: { increment: delta.comments } } : {}),
      ...(delta.reports ? { reports: { increment: delta.reports } } : {})
    }
  });

  const derived = scoreFromStats(stats);
  return app.prisma.contentScore.update({
    where: { id: stats.id },
    data: derived
  });
}

export async function recordFeedEventScoreImpact(
  app: FastifyInstance,
  event: {
    eventType: FeedEventType;
    targetType: FeedEventTargetType;
    targetId: string;
    dwellMs?: number;
    progress?: number;
  }
) {
  const delta: ScoreDelta = {};

  switch (event.eventType) {
    case "IMPRESSION":
      delta.impressions = 1;
      break;
    case "OPEN":
      delta.opens = 1;
      break;
    case "READ_PROGRESS":
      if ((event.progress ?? 0) >= 90) {
        delta.completions = 1;
      }
      break;
    case "DWELL_TIME":
      delta.totalDwellMs = event.dwellMs ?? 0;
      break;
    case "LIKE":
      delta.likes = 1;
      break;
    case "SAVE":
    case "BOOKMARK":
      delta.saves = 1;
      break;
    case "HIDE":
      delta.hides = 1;
      break;
    case "SHARE":
      delta.shares = 1;
      break;
    case "COMMENT":
      delta.comments = 1;
      break;
  }

  return incrementContentScore(app, event.targetType, event.targetId, delta);
}
