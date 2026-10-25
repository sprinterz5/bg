import argon2 from "argon2";
import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env.js";
import { sendMail, shouldExposeDevEmailToken } from "../services/emailService.js";
import { sendWelcomeChat } from "../services/welcomeChat.js";
import { endpointRateLimit } from "../services/rateLimitService.js";
import { checkUsernameAvailability, normalizeUsername, validateUsername } from "../services/usernameService.js";
import { normalizePhone } from "../utils/phone.js";
import { sha256 } from "../utils/hash.js";
import { toTokenPayload } from "../utils/authPayload.js";
import { privateUserSelect } from "../utils/users.js";
import { asApi, type ApiAuthResponse, type ApiSocialResponse, type ApiUsernameAvailability } from "../contracts/api.js";

const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const googleClientIds = env.GOOGLE_CLIENT_IDS.split(",").map((id) => id.trim()).filter(Boolean);

// Letters, digits, _ and . (case-insensitive); a dot cannot start or end the name or repeat.
const USERNAME_FORMAT = /^(?!\.)(?!.*\.\.)[a-zA-Z0-9_.]+(?<!\.)$/;

// At least 6 characters with at least one letter (signup step "Create a password").
const passwordSchema = z.string().min(6).max(200).regex(/\p{L}/u, "Password must contain at least one letter");

const registerSchema = z.object({
  // Optional: the signup flow is username + password; an email can be added later for recovery.
  email: z.string().email().transform((value) => value.toLowerCase()).optional(),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(USERNAME_FORMAT)
    .transform(normalizeUsername),
  displayName: z.string().min(1).max(80).optional(),
  // International form; stored as E.164. Not verified yet.
  phone: z.string().max(32).optional(),
  password: passwordSchema,
  interests: z.array(z.string().min(1).max(40)).max(20).default([]),
  // "I'm 13 or older" at signup; logged as a consent.
  ageConfirmed: z.literal(true)
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
  password: passwordSchema
});

const verifyEmailSchema = z.object({
  token: z.string().min(32)
});

const usernameAvailabilitySchema = z.object({
  username: z.string().min(1).max(80)
});

// Sign-in with Apple / Google. Accounts are only created through these providers: the first call
// (token only) tells the app whether the account exists; for a new one the app collects name,
// username, password and interests, then calls again with the same token plus those fields.
// Minimum age agreed at signup; bump the version when the wording or the age changes.
const AGE_CONSENT = { kind: "AGE_13", version: "1" } as const;

function ageConsent(request: FastifyRequest) {
  return { ...AGE_CONSENT, ipAddress: request.ip, userAgent: request.headers["user-agent"] };
}

const socialSchema = z.object({
  identityToken: z.string().min(1),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(USERNAME_FORMAT)
    .transform(normalizeUsername)
    .optional(),
  displayName: z.string().min(1).max(80).optional(),
  // Optional: lets the user also log in by username. The signup screen asks for at least 6 characters.
  password: z.string().min(6).max(200).optional(),
  interests: z.array(z.string().min(1).max(40)).max(20).default([]),
  // Required when the call creates the account (with username).
  ageConfirmed: z.literal(true).optional()
});

type SocialIdentity = {
  provider: "apple" | "google";
  subject: string;
  email?: string;
  emailVerified: boolean;
};

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

  // The phone step of the signup: a number can belong to one account.
  const phoneCheckLimit = endpointRateLimit({ key: "auth-phone-check", limit: 30, windowSeconds: 60 });
  app.get("/auth/phone-availability", { preHandler: [phoneCheckLimit] }, async (request, reply) => {
    const { phone: input } = z.object({ phone: z.string().max(32) }).parse(request.query);
    const phone = normalizePhone(input);
    if (!phone) throw reply.badRequest("Invalid phone number");
    const taken = await app.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    return asApi<ApiUsernameAvailability>({ available: !taken });
  });

  app.get("/auth/username-availability", async (request) => {
    const query = usernameAvailabilitySchema.parse(request.query);
    return asApi<ApiUsernameAvailability>(await checkUsernameAvailability(app.prisma, query.username));
  });

  app.post("/auth/register", { preHandler: [authWriteLimit] }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const phone = body.phone ? normalizePhone(body.phone) : null;
    if (body.phone && !phone) {
      throw reply.badRequest("Invalid phone number");
    }
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
        OR: [...(body.email ? [{ email: body.email }] : []), ...(phone ? [{ phone }] : []), { username: body.username }]
      }
    });

    if (existing) {
      if (phone && existing.phone === phone) {
        return reply.status(409).send({ error: "phone_taken", message: "This phone number is already used" });
      }
      throw reply.conflict("Email or username is already taken");
    }

    const passwordHash = await argon2.hash(body.password);
    const user = await app.prisma.user.create({
      data: {
        email: body.email ?? null,
        phone,
        username: body.username,
        displayName: body.displayName,
        passwordHash,
        interests: body.interests,
        consents: { create: ageConsent(request) }
      },
      select: privateUserSelect
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw reply.conflict("Email or username is already taken");
      }
      throw error;
    });

    const tokens = await issueTokens(app, user, request);
    await sendWelcomeChat(app.prisma, user.id);
    const emailVerificationToken = user.email ? await createEmailVerificationToken(app, { id: user.id, email: user.email }) : null;
    return reply.status(201).send({
      ...asApi<ApiAuthResponse>({ user, ...tokens }),
      ...(emailVerificationToken && shouldExposeDevEmailToken() ? { devEmailVerificationToken: emailVerificationToken } : {})
    });
  });

  app.post("/auth/login", { preHandler: [loginLimit] }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const phone = normalizePhone(body.login);
    const user = await app.prisma.user.findFirst({
      where: {
        OR: [
          { email: body.login.toLowerCase() },
          { username: normalizeUsername(body.login) },
          ...(phone ? [{ phone }] : [])
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
    return asApi<ApiAuthResponse>({ user: safeUser, ...tokens });
  });

  async function socialSignIn(identity: SocialIdentity, body: z.infer<typeof socialSchema>, request: any, reply: any) {
    const providerField = identity.provider === "apple" ? "appleUserId" : "googleUserId";
    // Only use the email as a secondary lookup key when the provider has verified it.
    // An unverified-email assertion must not be allowed to take over a pre-existing account.
    const verifiedEmail = identity.emailVerified ? identity.email : undefined;

    let user = await app.prisma.user.findFirst({
      where: {
        OR: [
          { [providerField]: identity.subject },
          ...(verifiedEmail ? [{ email: verifiedEmail }] : [])
        ]
      },
      select: privateUserSelect
    });

    if (user) {
      if (!user[providerField]) {
        user = await app.prisma.user.update({
          where: { id: user.id },
          data: { [providerField]: identity.subject },
          select: privateUserSelect
        });
      }
      const tokens = await issueTokens(app, user, request);
      return asApi<ApiSocialResponse>({ signupRequired: false, user, ...tokens });
    }

    if (!body.username) {
      // New person: the app runs the signup steps and calls again with the same token.
      return asApi<ApiSocialResponse>({ signupRequired: true, email: identity.email ?? null });
    }

    const usernameValidationReason = validateUsername(body.username);
    if (usernameValidationReason) {
      const availability = await checkUsernameAvailability(app.prisma, body.username);
      return reply.status(409).send({ error: "username_unavailable", ...availability });
    }

    if (!body.ageConfirmed) {
      throw reply.badRequest("Confirm that you are 13 or older");
    }

    const passwordHash = body.password ? await argon2.hash(body.password) : undefined;
    user = await app.prisma.user.create({
      data: {
        email: identity.email ?? `${identity.subject}@${identity.provider}.local`,
        username: body.username,
        displayName: body.displayName,
        passwordHash,
        [providerField]: identity.subject,
        emailVerified: identity.emailVerified,
        interests: body.interests,
        consents: { create: ageConsent(request) }
      },
      select: privateUserSelect
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw reply.conflict("Email or username is already taken");
      }
      throw error;
    });

    const tokens = await issueTokens(app, user, request);
    return asApi<ApiSocialResponse>({ signupRequired: false, user, ...tokens });
  }

  app.post("/auth/apple", { preHandler: [authWriteLimit] }, async (request, reply) => {
    if (!env.APPLE_CLIENT_ID) {
      throw reply.internalServerError("APPLE_CLIENT_ID is not configured");
    }

    const body = socialSchema.parse(request.body);
    const { payload } = await jwtVerify(body.identityToken, appleJwks, {
      issuer: "https://appleid.apple.com",
      audience: env.APPLE_CLIENT_ID
    }).catch(() => {
      throw reply.unauthorized("Invalid Apple identity token");
    });

    if (!payload.sub) {
      throw reply.unauthorized("Invalid Apple identity token");
    }

    // Apple sends the email only on the first authorization (possibly a private relay address).
    return socialSignIn(
      {
        provider: "apple",
        subject: payload.sub,
        email: typeof payload.email === "string" ? payload.email.toLowerCase() : undefined,
        emailVerified: payload.email_verified === true || payload.email_verified === "true"
      },
      body,
      request,
      reply
    );
  });

  app.post("/auth/google", { preHandler: [authWriteLimit] }, async (request, reply) => {
    if (!googleClientIds.length) {
      throw reply.internalServerError("GOOGLE_CLIENT_IDS is not configured");
    }

    const body = socialSchema.parse(request.body);
    const { payload } = await jwtVerify(body.identityToken, googleJwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: googleClientIds
    }).catch(() => {
      throw reply.unauthorized("Invalid Google ID token");
    });

    if (!payload.sub) {
      throw reply.unauthorized("Invalid Google ID token");
    }

    return socialSignIn(
      {
        provider: "google",
        subject: payload.sub,
        email: typeof payload.email === "string" ? payload.email.toLowerCase() : undefined,
        emailVerified: payload.email_verified === true || payload.email_verified === "true"
      },
      body,
      request,
      reply
    );
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
    if (!user.email) {
      throw reply.badRequest("The account has no email");
    }

    const token = await createEmailVerificationToken(app, { id: user.id, email: user.email });
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

    if (!user?.email) {
      return reply.status(202).send({ ok: true });
    }

    const token = await createPasswordResetToken(app, { id: user.id, email: user.email });
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
    return asApi<ApiAuthResponse>({ user, ...tokens });
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
