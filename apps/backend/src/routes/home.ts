import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getFriendsReadingNow, getMyReadingNow } from "../services/readingNowService.js";

const homeQuerySchema = z.object({
  feedMode: z.enum(["for_you", "following"]).default("for_you"),
  feedFilter: z.enum(["all", "articles", "books"]).default("all"),
  feedLimit: z.coerce.number().int().min(1).max(50).default(20),
  readingNowLimit: z.coerce.number().int().min(1).max(50).default(20)
});

export const homeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/home", { preHandler: [app.authenticate] }, async (request) => {
    const query = homeQuerySchema.parse(request.query);
    const authorization = request.headers.authorization;

    const [me, readingNowFriends, unreadNotifications, feedResponse] = await Promise.all([
      getMyReadingNow(app, request.user.sub),
      getFriendsReadingNow(app, request.user.sub, query.readingNowLimit),
      app.prisma.notification.count({
        where: {
          userId: request.user.sub,
          readAt: null
        }
      }),
      app.inject({
        method: "GET",
        url: `/feed?mode=${query.feedMode}&filter=${query.feedFilter}&limit=${query.feedLimit}`,
        headers: authorization ? { authorization } : {}
      })
    ]);

    const feedPayload = feedResponse.payload ? JSON.parse(feedResponse.payload) : { data: [] };

    return {
      viewer: {
        id: request.user.sub,
        username: request.user.username,
        role: request.user.role
      },
      notifications: {
        unreadCount: unreadNotifications
      },
      readingNow: {
        me,
        friends: readingNowFriends
      },
      feed: feedPayload
    };
  });
};
