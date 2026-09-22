import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getFriendsReadingNow, getMyReadingNow } from "../services/readingNowService.js";

export const readingNowRoutes: FastifyPluginAsync = async (app) => {
  app.get("/reading-now/me", { preHandler: [app.authenticate] }, async (request) => {
    return { data: await getMyReadingNow(app, request.user.sub) };
  });

  app.get("/reading-now/friends", { preHandler: [app.authenticate] }, async (request) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(request.query);
    return { data: await getFriendsReadingNow(app, request.user.sub, query.limit) };
  });
};
