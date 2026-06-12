import { Platform } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const deviceTokenSchema = z.object({
  token: z.string().min(16).max(4096),
  platform: z.nativeEnum(Platform)
});

export const deviceTokenRoutes: FastifyPluginAsync = async (app) => {
  app.post("/device-tokens", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = deviceTokenSchema.parse(request.body);
    const deviceToken = await app.prisma.deviceToken.upsert({
      where: { token: body.token },
      create: {
        userId: request.user.sub,
        token: body.token,
        platform: body.platform
      },
      update: {
        userId: request.user.sub,
        platform: body.platform
      }
    });

    return reply.status(201).send(deviceToken);
  });

  app.delete("/device-tokens", { preHandler: [app.authenticate] }, async (request) => {
    const body = z.object({ token: z.string().min(1) }).parse(request.body);
    await app.prisma.deviceToken.deleteMany({
      where: {
        userId: request.user.sub,
        token: body.token
      }
    });

    return { ok: true };
  });
};
