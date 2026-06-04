import { Redis } from "ioredis";
import fp from "fastify-plugin";
import { env } from "../config/env.js";

export const redisPlugin = fp(async (app) => {
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    retryStrategy: () => null
  });

  redis.on("error", (error) => {
    app.log.debug({ error }, "Redis connection error");
  });

  try {
    await redis.connect();
  } catch (error) {
    app.log.warn({ error }, "Redis is unavailable; cache and realtime fanout will degrade");
  }

  app.decorate("redis", redis);

  app.addHook("onClose", async () => {
    redis.disconnect();
  });
});
