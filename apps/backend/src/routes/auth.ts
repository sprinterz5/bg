import argon2 from "argon2";
import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env.js";
import { sendMail, shouldExposeDevEmailToken } from "../services/emailService.js";
import { endpointRateLimit } from "../services/rateLimitService.js";
import { checkUsernameAvailability, normalizeUsername, validateUsername } from "../services/usernameService.js";
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
    .regex(/^[a-zA-Z0-9_]+$/)
    .transform(normalizeUsername),
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

const logoutAllSchema = z.object({
  keepRefreshToken: z.string().min(1).optional()
});

const forgotPasswordSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase())
});

const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8).max(200)
});

const verifyEmailSchema = z.object({
  token: z.string().min(32)
});

const usernameAvailabilitySchema = z.object({
  username: z.string().min(1).max(80)
});

const appleSchema = z.object({
  identityToken: z.string().min(1),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/)
    .transform(normalizeUsername)
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

async function createEmailVerificationToken(app: Parameters<FastifyPluginAsync>[0], user: { id: string; email: string }) {
  const token = randomUUID() + randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await app.prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifyToken: sha256(token),
      emailVerifyExpires: expiresAt
    }
  });

  const url = `${env.EMAIL_VERIFY_URL}?token=${encodeURIComponent(token)}`;
  await sendMail(app, {
    to: user.email,
    subject: "Verify your Bookgram email",
    text: `Verify your Bookgram email: ${url}`
  });

  return token;
}

async function createPasswordResetToken(app: Parameters<FastifyPluginAsync>[0], user: { id: string; email: string }) {
  const token = randomUUID() + randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await app.prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: sha256(token),
      passwordResetExpires: expiresAt
    }
  });

  const url = `${env.PASSWORD_RESET_URL}?token=${encodeURIComponent(token)}`;
  await sendMail(app, {
    to: user.email,
    subject: "Reset your Bookgram password",
    text: `Reset your Bookgram password: ${url}`
  });

  return token;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  const authWriteLimit = endpointRateLimit({ key: "auth-write", limit: 20, windowSeconds: 60, failClosed: true });
  const loginLimit = endpointRateLimit({ key: "auth-login", limit: 10, windowSeconds: 60, failClosed: true });
  const forgotLimit = endpointRateLimit({ key: "auth-forgot", limit: 5, windowSeconds: 15 * 60, failClosed: true });

  app.get("/auth/username-availability", async (request) => {
    const query = usernameAvailabilitySchema.parse(request.query);
    return checkUsernameAvailability(app.prisma, query.username);
  });

  app.post("/auth/register", { preHandler: [authWriteLimit] }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const usernameValidationReason = validateUsername(body.username);
    if (usernameValidationReason) {
      const availability = await checkUsernameAvailability(app.prisma, body.username);
      return reply.status(409).send({
        error: "username_unavailable",
        ...availability
      });
    }

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
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw reply.conflict("Email or username is already taken");
      }
      throw error;
    });

    const tokens = await issueTokens(app, user, request);
    const emailVerificationToken = await createEmailVerificationToken(app, user);
    return reply.status(201).send({
      user,
      ...tokens,
      ...(shouldExposeDevEmailToken() ? { devEmailVerificationToken: emailVerificationToken } : {})
    });
  });

  app.post("/auth/login", { preHandler: [loginLimit] }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await app.prisma.user.findFirst({
      where: {
        OR: [
          { email: body.login.toLowerCase() },
          { username: normalizeUsername(body.login) }
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

    const rawEmail = typeof payload.email === "string" ? payload.email.toLowerCase() : undefined;
    // Only use the email as a secondary lookup key when Apple has verified it.
    // An unverified-email Apple assertion must not be allowed to take over a
    // pre-existing password account.
    const emailVerifiedByApple = payload.email_verified === true;
    const email = emailVerifiedByApple ? rawEmail : undefined;
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
      const generatedUsername = `reader_${appleUserId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)}`;
      const username = body.username ?? generatedUsername;
      const usernameValidationReason = validateUsername(username);
      if (usernameValidationReason) {
        throw reply.conflict("Username is not available");
      }

      const usernameTaken = await app.prisma.user.findUnique({ where: { username } });
      if (usernameTaken) {
        throw reply.conflict("Username is already taken");
      }

      user = await app.prisma.user.create({
        data: {
          email: rawEmail ?? `${appleUserId}@apple.local`,
          username,
          displayName: body.displayName,
          appleUserId,
          emailVerified: payload.email_verified === true,
          interests: body.interests
        },
        select: privateUserSelect
      }).catch((error) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw reply.conflict("Email or username is already taken");
        }
        throw error;
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

  app.post("/auth/email/request-verification", { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await app.prisma.user.findUniqueOrThrow({
      where: { id: request.user.sub },
      select: { id: true, email: true, emailVerified: true }
    });
    if (user.emailVerified) {
      return { ok: true, alreadyVerified: true };
    }

    const token = await createEmailVerificationToken(app, user);
    return reply.status(202).send({
      ok: true,
      alreadyVerified: false,
      ...(shouldExposeDevEmailToken() ? { devEmailVerificationToken: token } : {})
    });
  });

  app.post("/auth/email/verify", async (request, reply) => {
    const body = verifyEmailSchema.parse(request.body);
    const tokenHash = sha256(body.token);
    const user = await app.prisma.user.findFirst({
      where: {
        emailVerifyToken: tokenHash,
        emailVerifyExpires: { gt: new Date() },
        deletedAt: null
      },
      select: { id: true }
    });

    if (!user) {
      throw reply.badRequest("Invalid or expired email verification token");
    }

    const updated = await app.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null
      },
      select: privateUserSelect
    });

    return { ok: true, user: updated };
  });

  app.post("/auth/password/forgot", { preHandler: [forgotLimit] }, async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);
    const user = await app.prisma.user.findFirst({
      where: { email: body.email, deletedAt: null },
      select: { id: true, email: true }
    });

    if (!user) {
      return reply.status(202).send({ ok: true });
    }

    const token = await createPasswordResetToken(app, user);
    return reply.status(202).send({
      ok: true,
      ...(shouldExposeDevEmailToken() ? { devPasswordResetToken: token } : {})
    });
  });

  app.post("/auth/password/reset", async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);
    const tokenHash = sha256(body.token);
    const user = await app.prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpires: { gt: new Date() },
        deletedAt: null
      },
      select: { id: true }
    });

    if (!user) {
      throw reply.badRequest("Invalid or expired password reset token");
    }

    const passwordHash = await argon2.hash(body.password);
    await app.prisma.$transaction([
      app.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null
        }
      }),
      app.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);

    return { ok: true };
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

  app.get("/auth/sessions", { preHandler: [app.authenticate] }, async (request) => {
    const sessions = await app.prisma.refreshToken.findMany({
      where: {
        userId: request.user.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true
      }
    });

    return { data: sessions };
  });

  app.delete("/auth/sessions/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await app.prisma.refreshToken.updateMany({
      where: {
        id,
        userId: request.user.sub,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });

    if (result.count === 0) {
      throw reply.notFound("Session not found");
    }

    return { ok: true };
  });

  app.post("/auth/logout-all", { preHandler: [app.authenticate] }, async (request) => {
    const body = logoutAllSchema.parse(request.body ?? {});
    const keepHash = body.keepRefreshToken ? sha256(body.keepRefreshToken) : undefined;

    await app.prisma.refreshToken.updateMany({
      where: {
        userId: request.user.sub,
        revokedAt: null,
        ...(keepHash ? { tokenHash: { not: keepHash } } : {})
      },
      data: { revokedAt: new Date() }
    });

    return { ok: true };
  });
};
