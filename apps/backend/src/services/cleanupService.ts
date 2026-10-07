import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export async function runCleanupJobs(app: FastifyInstance) {
  const idempotencyCutoff = new Date(Date.now() - env.JOB_IDEMPOTENCY_RETENTION_HOURS * 60 * 60 * 1000);
  const jobRunCutoff = new Date(Date.now() - env.JOB_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const feedEventCutoff = new Date(Date.now() - env.FEED_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const [expiredIdempotencyKeys, oldJobRuns, expiredStories, oldFeedEvents] = await Promise.all([
    app.prisma.idempotencyKey.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { createdAt: { lt: idempotencyCutoff } }
        ]
      }
    }),
    app.prisma.jobRun.deleteMany({
      where: {
        finishedAt: { lt: jobRunCutoff }
      }
    }),
    // Transition past-expiry ACTIVE stories to EXPIRED so the admin dashboard
    // count is accurate and media assets can eventually be GC'd.
    app.prisma.story.updateMany({
      where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" }
    }),
    // Passive events only matter as counters (already in ContentScore); opens / likes stay for "already seen".
    app.prisma.feedEvent.deleteMany({
      where: {
        eventType: { in: ["IMPRESSION", "DWELL_TIME", "READ_PROGRESS"] },
        createdAt: { lt: feedEventCutoff }
      }
    })
  ]);

  return {
    expiredIdempotencyKeys: expiredIdempotencyKeys.count,
    oldJobRuns: oldJobRuns.count,
    expiredStories: expiredStories.count,
    oldFeedEvents: oldFeedEvents.count
  };
}
