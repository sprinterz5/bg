import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { endpointRateLimit } from "../services/rateLimitService.js";

// Crashes and errors from the app land in the server log (no table): the only way to see what went wrong on
// a phone without a cable. Signed-in or not; capped per IP.
const clientLogSchema = z.object({
  level: z.enum(["error", "warn"]),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  fatal: z.boolean().optional(),
  platform: z.string().max(20).optional(),
  appVersion: z.string().max(40).optional()
});

export const clientLogRoutes: FastifyPluginAsync = async (app) => {
  const limit = endpointRateLimit({ key: "client-log", limit: 30, windowSeconds: 60 });

  app.post("/client-logs", { preHandler: [limit] }, async (request, reply) => {
    const body = clientLogSchema.parse(request.body);
    let userId: string | undefined;
    if (request.headers.authorization) {
      userId = await request.jwtVerify().then(() => request.user.sub, () => undefined);
    }
    const { level, message, ...rest } = body;
    app.log[level]({ clientLog: { ...rest, userId } }, `[app] ${message}`);
    return reply.status(204).send();
  });
};
