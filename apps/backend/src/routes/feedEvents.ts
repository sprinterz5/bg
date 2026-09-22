import { FeedEventTargetType, FeedEventType } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { recordFeedEventScoreImpact } from "../services/contentScoreService.js";
import { endpointRateLimit } from "../services/rateLimitService.js";

// Only passive telemetry events are allowed to influence content scores from
// the client feed-events endpoint. Action events (LIKE/SAVE/SHARE/COMMENT/HIDE)
// are derived from the authoritative Like/Bookmark/Comment/share tables; letting
// clients submit them here would allow ballot-stuffing scores for any content.
export const SCORE_CONTRIBUTING_EVENT_TYPES = new Set<FeedEventType>([
  FeedEventType.IMPRESSION,
  FeedEventType.OPEN,
  FeedEventType.READ_PROGRESS,
  FeedEventType.DWELL_TIME
]);

// Cap realistic client dwell time at 2 hours to prevent inflated quality scores.
export const MAX_DWELL_MS = 2 * 60 * 60 * 1000;

const eventSchema = z.object({
  eventType: z.nativeEnum(FeedEventType),
  targetType: z.nativeEnum(FeedEventTargetType),
  targetId: z.string().uuid(),
  source: z.string().max(80).optional(),
  dwellMs: z.number().int().min(0).max(MAX_DWELL_MS).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(100)
});

export const feedEventRoutes: FastifyPluginAsync = async (app) => {
  app.post("/feed/events", { preHandler: [app.authenticate, endpointRateLimit({ key: "feed-events", limit: 240, windowSeconds: 60, by: "userOrIp" })] }, async (request, reply) => {
    const body = z.union([eventSchema, batchSchema]).parse(request.body);
    const events = "events" in body ? body.events : [body];

    await app.prisma.feedEvent.createMany({
      data: events.map((event) => ({
        userId: request.user.sub,
        eventType: event.eventType,
        targetType: event.targetType,
        targetId: event.targetId,
        source: event.source,
        dwellMs: event.dwellMs,
        progress: event.progress,
        metadata: event.metadata as any
      }))
    });

    // Only allow passive telemetry events to influence scores from this endpoint.
    // Action events (LIKE/SAVE/SHARE/COMMENT/HIDE) are counted from the
    // authoritative tables, not from client-submitted analytics.
    const scoringEvents = events.filter((e) => SCORE_CONTRIBUTING_EVENT_TYPES.has(e.eventType));
    await Promise.all(scoringEvents.map((event) => recordFeedEventScoreImpact(app, event)));

    // Feed cache keys carry a TTL; we intentionally skip the KEYS-based
    // invalidation here because KEYS O(N) blocks Redis on hot paths.
    // Cache staleness is bounded by the TTL set at write time.

    return reply.status(201).send({ ok: true, count: events.length });
  });

  app.get("/me/feed-events/summary", { preHandler: [app.authenticate] }, async (request) => {
    const rows = await app.prisma.feedEvent.groupBy({
      by: ["eventType"],
      where: { userId: request.user.sub },
      _count: { _all: true }
    });

    return {
      data: rows.map((row) => ({
        eventType: row.eventType,
        count: row._count._all
      }))
    };
  });
};
