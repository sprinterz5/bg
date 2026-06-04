import type { FastifyInstance } from "fastify";
import { Server as SocketIOServer } from "socket.io";
import { corsOrigins } from "../config/env.js";
import type { AuthenticatedUser } from "../types/fastify.js";

function bearerToken(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  return value.startsWith("Bearer ") ? value.slice("Bearer ".length) : value;
}

export function setupRealtime(app: FastifyInstance) {
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: corsOrigins,
      credentials: true
    }
  });

  app.decorate("io", io);

  io.use(async (socket, next) => {
    const token =
      bearerToken(socket.handshake.auth.token) ??
      bearerToken(socket.handshake.headers.authorization);

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const user = app.jwt.verify<AuthenticatedUser>(token);
      socket.data.user = user;
      return next();
    } catch {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user as AuthenticatedUser;
    socket.join(`user:${user.sub}`);

    await app.prisma.user.update({
      where: { id: user.sub },
      data: { lastSeenAt: new Date() }
    }).catch(() => undefined);

    const memberships = await app.prisma.conversationMember.findMany({
      where: { userId: user.sub },
      select: { conversationId: true }
    });

    memberships.forEach((membership) => {
      socket.join(`conversation:${membership.conversationId}`);
    });

    socket.on("conversation:join", async ({ conversationId }: { conversationId?: string }) => {
      if (!conversationId) {
        return;
      }
      const member = await app.prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: user.sub
          }
        }
      });
      if (member) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on("typing", async ({ conversationId }: { conversationId?: string }) => {
      if (!conversationId) {
        return;
      }
      const member = await app.prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: user.sub
          }
        }
      });
      if (member) {
        socket.to(`conversation:${conversationId}`).emit("typing", {
          conversationId,
          userId: user.sub,
          username: user.username
        });
      }
    });
  });

  app.addHook("onClose", async () => {
    io.close();
  });
}
