import { LikeTargetType } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { incrementContentScore } from "../services/contentScoreService.js";
import { incrementContentCounter } from "../services/counterService.js";

const likeSchema = z.object({
  targetType: z.nativeEnum(LikeTargetType),
  targetId: z.string().uuid()
});

export const likeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/likes/toggle", { preHandler: [app.authenticate] }, async (request) => {
    const body = likeSchema.parse(request.body);
    const existing = await app.prisma.like.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: request.user.sub,
          targetType: body.targetType,
          targetId: body.targetId
        }
      }
    });

    if (existing) {
      await app.prisma.like.delete({ where: { id: existing.id } });
      await incrementContentScore(app, body.targetType, body.targetId, { likes: -1 });
      await incrementContentCounter(app, body.targetType, body.targetId, { likes: -1 });
      return { liked: false };
    }

    await app.prisma.like.create({
      data: {
        userId: request.user.sub,
        targetType: body.targetType,
        targetId: body.targetId
      }
    });
    await incrementContentScore(app, body.targetType, body.targetId, { likes: 1 });
    await incrementContentCounter(app, body.targetType, body.targetId, { likes: 1 });

    return { liked: true };
  });
};
