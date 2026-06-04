import argon2 from "argon2";
import type { FastifyPluginAsync } from "fastify";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env.js";
import { sha256 } from "../utils/hash.js";
import { toTokenPayload } from "../utils/authPayload.js";
import { privateUserSelect } from "../utils/users.js";

const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

const registerSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(80).optional(),
  password: z.string().min(8).max(200),
  interests: z.array(z.string().min(1).max(40)).max(20).default([])
});

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

const appleSchema = z.object({
  identityToken: z.string().min(1),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  displayName: z.string().min(1).max(80).optional(),
  interests: z.array(z.string().min(1).max(40)).max(20).default([])
});

async function signRefreshToken(user: { id: string; username: string; role: string }) {
  return new SignJWT({
    kind: "refresh",
    username: user.username,
    role: user.role
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(`${env.REFRESH_TOKEN_TTL_DAYS}d`)
    .sign(refreshSecret);
}

async function verifyRefreshToken(refreshToken: string) {
  const { payload } = await jwtVerify(refreshToken, refreshSecret);
  if (payload.kind !== "refresh" || typeof payload.sub !== "string") {
    throw new Error("Invalid refresh token");
  }

  return payload.sub;
}

async function issueTokens(app: Parameters<FastifyPluginAsync>[0], user: { id: string; username: string; role: any }, request: any) {
  const accessToken = app.jwt.sign(toTokenPayload(user));
  const refreshToken = await signRefreshToken(user);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await app.prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
      expiresAt
    }
  });

  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer"
  };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const existing = await app.prisma.user.findFirst({
      where: {
        OR: [{ email: body.email }, { username: body.username }]
      }
    });

    if (existing) {
      throw reply.conflict("Email or username is already taken");
    }

    const passwordHash = await argon2.hash(body.password);
    const user = await app.prisma.user.create({
      data: {
        email: body.email,
        username: body.username,
        displayName: body.displayName,
        passwordHash,
        interests: body.interests
      },
      select: privateUserSelect
    });

    const tokens = await issueTokens(app, user, request);
    return reply.status(201).send({ user, ...tokens });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await app.prisma.user.findFirst({
      where: {
        OR: [
          { email: body.login.toLowerCase() },
          { username: body.login }
        ],
        deletedAt: null
      }
    });

    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, body.password))) {
      throw reply.unauthorized("Invalid credentials");
    }

    await app.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() }
    });

    const safeUser = await app.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: privateUserSelect
    });
    const tokens = await issueTokens(app, safeUser, request);
    return { user: safeUser, ...tokens };
  });

  app.post("/auth/apple", async (request, reply) => {
    if (!env.APPLE_CLIENT_ID) {
      throw reply.internalServerError("APPLE_CLIENT_ID is not configured");
    }

    const body = appleSchema.parse(request.body);
    const { payload } = await jwtVerify(body.identityToken, appleJwks, {
      issuer: "https://appleid.apple.com",
      audience: env.APPLE_CLIENT_ID
    });

    if (!payload.sub) {
      throw reply.unauthorized("Invalid Apple identity token");
    }

    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : undefined;
    const appleUserId = payload.sub;

    let user = await app.prisma.user.findFirst({
      where: {
        OR: [
          { appleUserId },
          ...(email ? [{ email }] : [])
        ]
      },
      select: privateUserSelect
    });

    if (!user) {
      const username = body.username ?? `reader_${appleUserId.slice(0, 10)}`;
      const usernameTaken = await app.prisma.user.findUnique({ where: { username } });
      if (usernameTaken) {
        throw reply.conflict("Username is already taken");
      }

      user = await app.prisma.user.create({
        data: {
          email: email ?? `${appleUserId}@apple.local`,
          username,
          displayName: body.displayName,
          appleUserId,
          interests: body.interests
        },
        select: privateUserSelect
      });
    } else if (!user.appleUserId) {
      user = await app.prisma.user.update({
        where: { id: user.id },
        data: { appleUserId },
        select: privateUserSelect
      });
    }

    const tokens = await issueTokens(app, user, request);
    return { user, ...tokens };
  });

  app.get("/auth/me", { preHandler: [app.authenticate] }, async (request) => {
    return app.prisma.user.findUniqueOrThrow({
      where: { id: request.user.sub },
      select: privateUserSelect
    });
  });

  app.post("/auth/refresh", async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const userId = await verifyRefreshToken(body.refreshToken).catch(() => null);
    if (!userId) {
      throw reply.unauthorized("Invalid refresh token");
    }

    const tokenHash = sha256(body.refreshToken);
    const storedToken = await app.prisma.refreshToken.findUnique({
      where: { tokenHash }
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw reply.unauthorized("Refresh token expired or revoked");
    }

    await app.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() }
    });

    const user = await app.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: privateUserSelect
    });
    const tokens = await issueTokens(app, user, request);
    return { user, ...tokens };
  });

  app.post("/auth/logout", async (request) => {
    const body = refreshSchema.parse(request.body);
    await app.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(body.refreshToken) },
      data: { revokedAt: new Date() }
    });

    return { ok: true };
  });
};
