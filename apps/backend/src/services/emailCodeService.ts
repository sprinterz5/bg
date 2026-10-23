import type { FastifyInstance } from "fastify";
import { jwtVerify, SignJWT } from "jose";
import { randomInt } from "node:crypto";
import { env } from "../config/env.js";
import { sha256 } from "../utils/hash.js";
import { sendMail } from "./emailService.js";

// Sign-up email check: a 6-digit code sent to the address (10 minutes, 5 tries, a new one at most once a minute);
// the right code gives a short-lived token that /auth/register takes as proof the address is the user's.
const CODE_TTL_SECONDS = 10 * 60;
const RESEND_AFTER_SECONDS = 60;
const MAX_TRIES = 5;
const secret = new TextEncoder().encode(`${env.JWT_SECRET}:signup-email`);

const domains = () => env.SIGNUP_EMAIL_DOMAINS.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** The address is on an allowed domain (any when the list is empty). */
export function isAllowedEmail(email: string) {
  const list = domains();
  const domain = email.split("@")[1] ?? "";
  return list.length === 0 || list.includes(domain);
}

const key = (email: string) => `signup-code:${sha256(email)}`;

export type SendResult = { sent: true; code?: string } | { sent: false; reason: "too_soon" | "not_delivered" };

export async function sendSignupCode(app: FastifyInstance, email: string): Promise<SendResult> {
  const cooldown = `${key(email)}:cooldown`;
  if (!(await app.redis.set(cooldown, "1", "EX", RESEND_AFTER_SECONDS, "NX"))) return { sent: false, reason: "too_soon" };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await app.redis.set(key(email), JSON.stringify({ hash: sha256(code), tries: 0 }), "EX", CODE_TTL_SECONDS);
  const delivered = await sendMail(app, {
    to: email,
    subject: `${code} is your sign-up code`,
    text: `Your code: ${code}\n\nIt works for 10 minutes. If you didn't ask for it, ignore this email.`
  });
  if (!delivered) {
    await app.redis.del(cooldown);
    return { sent: false, reason: "not_delivered" };
  }
  return { sent: true, ...(env.NODE_ENV !== "production" ? { code } : {}) };
}

/** A token proving the address, or null for a wrong / expired code (the code dies after 5 wrong tries). */
export async function checkSignupCode(app: FastifyInstance, email: string, code: string): Promise<string | null> {
  const raw = await app.redis.get(key(email));
  if (!raw) return null;
  const stored = JSON.parse(raw) as { hash: string; tries: number };
  if (stored.hash !== sha256(code.trim())) {
    if (stored.tries + 1 >= MAX_TRIES) await app.redis.del(key(email));
    else await app.redis.set(key(email), JSON.stringify({ ...stored, tries: stored.tries + 1 }), "KEEPTTL");
    return null;
  }
  await app.redis.del(key(email));
  return new SignJWT({ kind: "signup-email", email }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30m").sign(secret);
}

/** The proven address in a token from checkSignupCode, or null. */
export async function emailFromToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.kind === "signup-email" && typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}
