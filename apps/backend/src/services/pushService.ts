import type { Notification, Platform } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

type PushToken = {
  token: string;
  platform: Platform;
};

export async function sendPushForNotification(
  app: FastifyInstance,
  notification: Notification,
  tokens: PushToken[]
) {
  if (tokens.length === 0 || env.PUSH_DELIVERY_MODE === "DISABLED") {
    return;
  }

  if (env.PUSH_DELIVERY_MODE === "LOG") {
    app.log.info(
      {
        userId: notification.userId,
        notificationId: notification.id,
        title: notification.title,
        body: notification.body,
        tokens: tokens.map((token) => ({
          platform: token.platform,
          tokenPreview: `${token.token.slice(0, 8)}...`
        }))
      },
      "Push notification queued via development transport"
    );
  }
}
