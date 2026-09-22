import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { runAiEmbeddingBackfill } from "../services/aiEmbeddingService.js";
import { runCleanupJobs } from "../services/cleanupService.js";
import { runMaintenanceJobs } from "../services/maintenanceService.js";
import { runMediaModerationJob } from "../services/mediaModerationService.js";
import { runSpamScoringJob } from "../services/spamScoringService.js";
import { runTrackedJob } from "../services/jobRunService.js";

type JobRun = {
  name: string;
  fn: () => Promise<unknown>;
  intervalMs: number;
  lockTtlSeconds: number;
};

async function runWithRedisLock(app: FastifyInstance, name: string, ttlSeconds: number, fn: () => Promise<unknown>) {
  const lockKey = `jobs:lock:${name}`;
  const lockValue = `${process.pid}:${Date.now()}`;
  const acquired = await app.redis.set(lockKey, lockValue, "EX", ttlSeconds, "NX").catch(() => null);
  if (acquired !== "OK") {
    return;
  }

  const startedAt = Date.now();
  try {
    app.log.info({ job: name }, "Background job started");
    const result = await runTrackedJob(app.prisma, {
      name,
      payload: { source: "background_runner" },
      fn
    });
    app.log.info({ job: name, durationMs: Date.now() - startedAt, result }, "Background job finished");
  } catch (error) {
    app.log.error({ job: name, error }, "Background job failed");
  } finally {
    const currentValue = await app.redis.get(lockKey).catch(() => null);
    if (currentValue === lockValue) {
      await app.redis.del(lockKey).catch(() => undefined);
    }
  }
}

function minutes(value: number) {
  return value * 60 * 1000;
}

export function startBackgroundJobs(app: FastifyInstance) {
  if (!env.JOB_RUNNER_ENABLED) {
    app.log.info("Background job runner disabled");
    return;
  }

  const jobs: JobRun[] = [
    {
      name: "spam-score",
      intervalMs: minutes(env.JOB_SPAM_SCORE_INTERVAL_MINUTES),
      lockTtlSeconds: Math.max(env.JOB_SPAM_SCORE_INTERVAL_MINUTES * 60 - 5, 60),
      fn: () => runSpamScoringJob(app.prisma, { limit: env.JOB_SPAM_SCORE_LIMIT, threshold: env.JOB_SPAM_SCORE_THRESHOLD })
    },
    {
      name: "maintenance",
      intervalMs: minutes(env.JOB_MAINTENANCE_INTERVAL_MINUTES),
      lockTtlSeconds: Math.max(env.JOB_MAINTENANCE_INTERVAL_MINUTES * 60 - 5, 60),
      fn: () => runMaintenanceJobs(app, { bookLimit: env.JOB_BOOK_SIMILARITY_LIMIT })
    },
    {
      name: "ai-embedding-backfill",
      intervalMs: minutes(env.JOB_AI_EMBEDDINGS_INTERVAL_MINUTES),
      lockTtlSeconds: Math.max(env.JOB_AI_EMBEDDINGS_INTERVAL_MINUTES * 60 - 5, 60),
      fn: () => runAiEmbeddingBackfill(app, { limit: env.JOB_AI_EMBEDDINGS_LIMIT })
    },
    {
      name: "media-moderation",
      intervalMs: minutes(env.JOB_MAINTENANCE_INTERVAL_MINUTES),
      lockTtlSeconds: Math.max(env.JOB_MAINTENANCE_INTERVAL_MINUTES * 60 - 5, 60),
      fn: () => runMediaModerationJob(app, { limit: 100 })
    },
    {
      name: "cleanup",
      intervalMs: minutes(env.JOB_CLEANUP_INTERVAL_MINUTES),
      lockTtlSeconds: Math.max(env.JOB_CLEANUP_INTERVAL_MINUTES * 60 - 5, 60),
      fn: () => runCleanupJobs(app)
    }
  ];

  const timers = jobs.map((job) => {
    if (env.JOB_RUN_ON_STARTUP) {
      void runWithRedisLock(app, job.name, job.lockTtlSeconds, job.fn);
    }
    return setInterval(() => {
      void runWithRedisLock(app, job.name, job.lockTtlSeconds, job.fn);
    }, job.intervalMs);
  });

  app.addHook("onClose", async () => {
    for (const timer of timers) {
      clearInterval(timer);
    }
  });

  app.log.info(
    {
      jobs: jobs.map((job) => ({ name: job.name, intervalMs: job.intervalMs }))
    },
    "Background job runner enabled"
  );
}
