import type { PrismaClient, UserRole } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Redis } from "ioredis";
import type { Server as SocketIOServer } from "socket.io";

export interface AuthenticatedUser {
  sub: string;
  role: UserRole;
  username: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthenticatedUser;
    user: AuthenticatedUser;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    io: SocketIOServer;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      roles: UserRole[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
