import type { FastifyInstance } from "fastify";
import type {
  NotificationActorType,
  NotificationTargetType,
  NotificationType
} from "@prisma/client";
import { sendPushForNotification } from "./pushService.js";

export async function createNotification(
  app: FastifyInstance,
  input: {
    userId: string;
    type: NotificationType;
    actorType?: NotificationActorType;
    actorId?: string;
    targetType: NotificationTargetType;
    targetId?: string;
    title: string;
    body?: string;
    data?: unknown;
  }
) {
  const notification = await app.prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      actorType: input.actorType ?? "SYSTEM",
      actorId: input.actorId,
      targetType: input.targetType,
      targetId: input.targetId,
      title: input.title,
      body: input.body,
      data: input.data as any
    }
  });

  app.io.to(`user:${input.userId}`).emit("notification:new", notification);
  // Push goes out after the response: a like or follow shouldn't wait for the push provider.
  void app.prisma.deviceToken
    .findMany({
      where: { userId: input.userId },
      select: { token: true, platform: true }
    })
    .then((tokens) => sendPushForNotification(app, notification, tokens))
    .catch((error) => app.log.warn({ error, notificationId: notification.id }, "Push send failed"));

  return notification;
}
