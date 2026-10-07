import type { FastifyInstance } from "fastify";
import type { FeedEventTargetType, FeedEventType } from "@prisma/client";
import { feedEventScoreDelta, incrementContentScore, type ScoreDelta } from "./contentScoreService.js";

// Content score counters are collected in Redis and written to Postgres in batches: every impression / open /
// like used to be an upsert of the post's ContentScore row right in the request, so a popular post turned that
// row into a lock hot spot. Now a request does one HINCRBY and the flusher applies the sum every few seconds.

const PENDING = "scores:pending";
const FLUSH_INTERVAL_MS = 15_000;
const FLUSH_BATCH = 500;

function deltaKey(member: string) {
  return `scores:delta:${member}`;
}

function isContentTarget(targetType: string) {
  return targetType === "ARTICLE" || targetType === "REVIEW";
}

export async function bufferScoreDelta(app: FastifyInstance, targetType: string, targetId: string, delta: ScoreDelta) {
  if (!isContentTarget(targetType)) {
    return;
  }
  const entries = Object.entries(delta).filter(([, value]) => typeof value === "number" && value !== 0) as [string, number][];
  if (entries.length === 0) {
    return;
  }

  const member = `${targetType}:${targetId}`;
  try {
    const multi = app.redis.multi();
    for (const [field, value] of entries) {
      multi.hincrby(deltaKey(member), field, value);
    }
    multi.sadd(PENDING, member);
    const result = await multi.exec();
    if (!result || result.some(([error]) => error)) {
      throw new Error("Redis score buffer write failed");
    }
  } catch {
    // Redis down: fall back to the direct write rather than losing the signal.
    await incrementContentScore(app, targetType, targetId, delta);
  }
}

export async function recordFeedEventScoreImpact(
  app: FastifyInstance,
  event: { eventType: FeedEventType; targetType: FeedEventTargetType; targetId: string; dwellMs?: number; progress?: number }
) {
  return bufferScoreDelta(app, event.targetType, event.targetId, feedEventScoreDelta(event));
}

export async function flushScoreBuffer(app: FastifyInstance) {
  const members = (await app.redis.spop(PENDING, FLUSH_BATCH)) as string[];
  let flushed = 0;

  for (const member of members) {
    const [targetType = "", targetId = ""] = member.split(":");
    // Read and clear in one step: increments that land after this go into a fresh hash and re-add the member.
    const result = await app.redis.multi().hgetall(deltaKey(member)).del(deltaKey(member)).exec();
    const hash = (result?.[0]?.[1] ?? {}) as Record<string, string>;
    const delta = Object.fromEntries(Object.entries(hash).map(([field, value]) => [field, Number(value)])) as ScoreDelta;
    if (Object.keys(delta).length === 0) {
      continue;
    }

    try {
      await incrementContentScore(app, targetType, targetId, delta);
      flushed += 1;
    } catch (error) {
      app.log.warn({ error, member }, "Score flush failed, re-buffering");
      await bufferScoreDelta(app, targetType, targetId, delta).catch(() => undefined);
    }
  }

  return { flushed, more: members.length === FLUSH_BATCH };
}

/** Runs regardless of JOB_RUNNER_ENABLED: without it content scores would never update. */
export function startScoreFlusher(app: FastifyInstance) {
  let running = false;
  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      let more = true;
      while (more) {
        more = (await flushScoreBuffer(app)).more;
      }
    } catch (error) {
      app.log.warn({ error }, "Score flush tick failed");
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void tick(), FLUSH_INTERVAL_MS);
  timer.unref();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    await tick();
  });
}
