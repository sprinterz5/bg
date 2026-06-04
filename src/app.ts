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
import { swaggerPlugin } from "./plugins/swagger.js";
import { setupRealtime } from "./realtime/socket.js";
import { articleRoutes } from "./routes/articles.js";
import { authRoutes } from "./routes/auth.js";
import { bookRoutes } from "./routes/books.js";
import { chatRoutes } from "./routes/chats.js";
import { exploreRoutes } from "./routes/explore.js";
import { feedRoutes } from "./routes/feed.js";
import { healthRoutes } from "./routes/health.js";
import { likeRoutes } from "./routes/likes.js";
import { mediaRoutes } from "./routes/media.js";
import { moderationRoutes } from "./routes/moderation.js";
import { noteRoutes } from "./routes/notes.js";
import { reviewRoutes } from "./routes/reviews.js";
import { shelfRoutes } from "./routes/shelves.js";
import { storyRoutes } from "./routes/stories.js";
import { userRoutes } from "./routes/users.js";

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
  await app.register(sensible);
  await app.register(helmet);
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
  await app.register(fastifyStatic, {
    root: path.resolve(projectRoot, env.MEDIA_STORAGE_DIR),
    prefix: "/media/"
  });

  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);
  await app.register(swaggerPlugin);
  setupRealtime(app);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(bookRoutes);
  await app.register(shelfRoutes);
  await app.register(articleRoutes);
  await app.register(reviewRoutes);
  await app.register(noteRoutes);
  await app.register(likeRoutes);
  await app.register(feedRoutes);
  await app.register(mediaRoutes);
  await app.register(storyRoutes);
  await app.register(chatRoutes);
  await app.register(exploreRoutes);
  await app.register(moderationRoutes);

  return app;
}
