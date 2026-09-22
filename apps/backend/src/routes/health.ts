import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    let database = true;
    let redis = true;

    try {
      await app.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = false;
    }

    try {
      await app.redis.ping();
    } catch {
      redis = false;
    }

    return {
      status: database ? "ok" : "degraded",
      services: {
        database,
        redis
      }
    };
  });
};
