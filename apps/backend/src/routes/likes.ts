import { LikeTargetType } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createNotification } from "../services/notificationService.js";
import { bufferScoreDelta } from "../services/scoreBufferService.js";
import { incrementContentCounter } from "../services/counterService.js";

const likeSchema = z.object({
  targetType: z.nativeEnum(LikeTargetType),
  targetId: z.string().uuid(),
  // The state the app wants (taps are debounced on the phone); without it the call flips the current state.
  liked: z.boolean().optional()
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

    if (body.liked !== undefined && body.liked === !!existing) {
      return { liked: body.liked };
    }

    if (existing) {
      await app.prisma.like.delete({ where: { id: existing.id } });
      await bufferScoreDelta(app, body.targetType, body.targetId, { likes: -1 });
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
    await bufferScoreDelta(app, body.targetType, body.targetId, { likes: 1 });
    await incrementContentCounter(app, body.targetType, body.targetId, { likes: 1 });

    // The author hears about a like on their article (not their own).
    if (body.targetType === "ARTICLE") {
      const article = await app.prisma.article.findUnique({ where: { id: body.targetId }, select: { authorId: true, title: true } });
      // once per person and post: liking again after an unlike doesn't notify twice
      const already = await app.prisma.notification.findFirst({
        where: { type: "LIKE", actorId: request.user.sub, targetType: "ARTICLE", targetId: body.targetId },
        select: { id: true }
      });
      if (article && article.authorId !== request.user.sub && !already) {
        await createNotification(app, {
          userId: article.authorId,
          type: "LIKE",
          actorType: "USER",
          actorId: request.user.sub,
          targetType: "ARTICLE",
          targetId: body.targetId,
          title: "New like",
          body: `${request.user.username} liked "${article.title}".`
        });
      }
    }

    return { liked: true };
  });
};
