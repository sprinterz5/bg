import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { corsOrigins, env } from "./config/env.js";
import { authPlugin } from "./plugins/auth.js";
import { errorsPlugin } from "./plugins/errors.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { requestTimingPlugin } from "./plugins/requestTiming.js";
import { swaggerPlugin } from "./plugins/swagger.js";
import { startBackgroundJobs } from "./jobs/runner.js";
import { setupRealtime } from "./realtime/socket.js";
import { articleRoutes } from "./routes/articles.js";
import { adminRoutes } from "./routes/admin.js";
import { aiRoutes } from "./routes/ai.js";
import { authRoutes } from "./routes/auth.js";
import { blockRoutes } from "./routes/blocks.js";
import { bookmarkRoutes } from "./routes/bookmarks.js";
import { bookRoutes } from "./routes/books.js";
import { chatRoutes } from "./routes/chats.js";
import { commentRoutes } from "./routes/comments.js";
import { deviceTokenRoutes } from "./routes/deviceTokens.js";
import { exploreRoutes } from "./routes/explore.js";
import { feedRoutes } from "./routes/feed.js";
import { feedEventRoutes } from "./routes/feedEvents.js";
import { healthRoutes } from "./routes/health.js";
import { homeRoutes } from "./routes/home.js";
import { likeRoutes } from "./routes/likes.js";
import { mediaRoutes } from "./routes/media.js";
import { mediaModerationRoutes } from "./routes/mediaModeration.js";
import { moderationRoutes } from "./routes/moderation.js";
import { noteRoutes } from "./routes/notes.js";
import { notificationRoutes } from "./routes/notifications.js";
import { reportRoutes } from "./routes/reports.js";
import { reviewRoutes } from "./routes/reviews.js";
import { readingNowRoutes } from "./routes/readingNow.js";
import { searchRoutes } from "./routes/search.js";
import { shareRoutes } from "./routes/share.js";
import { shelfRoutes } from "./routes/shelves.js";
import { storyRoutes } from "./routes/stories.js";
import { userRoutes } from "./routes/users.js";
import { isMediaKeyApproved, readRemoteMediaObject } from "./services/mediaService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : env.NODE_ENV === "production"
          ? true
          : { transport: { target: "pino-pretty" } }
  });

  await app.register(errorsPlugin);
  await app.register(requestTimingPlugin);
  await app.register(sensible);
  await app.register(helmet);
  if (env.NODE_ENV === "production" && corsOrigins === true) {
    throw new Error(
      "CORS_ORIGIN must be set to explicit allowed origins in production. " +
      "Set CORS_ORIGIN to a comma-separated list of allowed origins (e.g. https://bookgram.app,bookgram-ios)."
    );
  }

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true
  });
  await app.register(rateLimit, {
    max: 250,
    timeWindow: "1 minute"
  });
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024
    }
  });
  if (env.MEDIA_STORAGE_PROVIDER === "LOCAL") {
    // Gate static media delivery on moderation status so unapproved uploads are
    // never served from disk. Only applies to paths that look like file keys
    // (contain a file extension); API routes under /media/ (e.g.
    // /media/moderation/readiness) are passed through to their handlers.
    app.addHook("onRequest", async (request, reply) => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return;
      }
      const requestPath = request.url.split("?")[0] ?? request.url;
      if (!requestPath.startsWith("/media/")) {
        return;
      }
      const key = decodeURIComponent(requestPath.slice("/media/".length));
      // Skip if the path segment has no file extension — it's an API route,
      // not a file being served by @fastify/static.
      if (!/\.[a-zA-Z0-9]+$/.test(key)) {
        return;
      }
      if (!(await isMediaKeyApproved(app.prisma, key))) {
        throw reply.notFound("Media object not found");
      }
    });
    await app.register(fastifyStatic, {
      root: path.resolve(projectRoot, env.MEDIA_STORAGE_DIR),
      prefix: "/media/"
    });
  } else {
    app.get("/media/*", async (request, reply) => {
      const params = request.params as { "*": string };
      const key = params["*"];
      if (!key || key.includes("..") || key.includes("\\")) {
        throw reply.badRequest("Invalid media key");
      }

      // Gate remote media delivery on moderation status so unapproved uploads
      // are never served from the bucket.
      if (!(await isMediaKeyApproved(app.prisma, key))) {
        throw reply.notFound("Media object not found");
      }

      try {
        const object = await readRemoteMediaObject(key);
        reply.header("content-type", object.contentType);
        reply.header("cache-control", object.cacheControl);
        if (typeof object.contentLength === "number") {
          reply.header("content-length", object.contentLength);
        }
        return reply.send(object.body);
      } catch (error: any) {
        if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
          throw reply.notFound("Media object not found");
        }
        throw error;
      }
    });
  }

  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);
  await app.register(swaggerPlugin);
  setupRealtime(app);

  await app.register(healthRoutes);
  await app.register(adminRoutes);
  await app.register(aiRoutes);
  await app.register(homeRoutes);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(blockRoutes);
  await app.register(deviceTokenRoutes);
  await app.register(bookRoutes);
  await app.register(bookmarkRoutes);
  await app.register(readingNowRoutes);
  await app.register(shelfRoutes);
  await app.register(articleRoutes);
  await app.register(reviewRoutes);
  await app.register(commentRoutes);
  await app.register(searchRoutes);
  await app.register(shareRoutes);
  await app.register(noteRoutes);
  await app.register(notificationRoutes);
  await app.register(reportRoutes);
  await app.register(likeRoutes);
  await app.register(feedRoutes);
  await app.register(feedEventRoutes);
  await app.register(mediaRoutes);
  await app.register(mediaModerationRoutes);
  await app.register(storyRoutes);
  await app.register(chatRoutes);
  await app.register(exploreRoutes);
  await app.register(moderationRoutes);
  startBackgroundJobs(app);

  return app;
}
