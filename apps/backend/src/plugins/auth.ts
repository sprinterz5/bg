import jwt from "@fastify/jwt";
import type { UserRole } from "@prisma/client";
import fp from "fastify-plugin";
import { env } from "../config/env.js";

export const authPlugin = fp(async (app) => {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.ACCESS_TOKEN_TTL
    }
  });

  app.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      throw reply.unauthorized("Authentication required");
    }
  });

  app.decorate("requireRole", (roles: UserRole[]) => {
    return async (request, reply) => {
      await app.authenticate(request, reply);
      if (!request.user || !roles.includes(request.user.role)) {
        throw reply.forbidden("Insufficient permissions");
      }
    };
  });
});
