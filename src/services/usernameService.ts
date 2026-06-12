import type { PrismaClient } from "@prisma/client";

const usernamePattern = /^[a-z0-9_]+$/;
const reservedUsernames = new Set([
  "admin",
  "administrator",
  "api",
  "app",
  "auth",
  "bookgram",
  "bookgram_admin",
  "bookgram_support",
  "help",
  "moderator",
  "official",
  "root",
  "security",
  "staff",
  "support",
  "system"
]);

export type UsernameAvailabilityReason = "invalid_format" | "reserved" | "taken";

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string): UsernameAvailabilityReason | null {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3 || normalized.length > 32 || !usernamePattern.test(normalized)) {
    return "invalid_format";
  }
  if (reservedUsernames.has(normalized)) {
    return "reserved";
  }

  return null;
}

function suggestionCandidates(username: string) {
  const normalized = normalizeUsername(username).replace(/[^a-z0-9_]/g, "").slice(0, 24) || "reader";
  const year = new Date().getUTCFullYear();
  return [
    `${normalized}_reads`,
    `${normalized}_books`,
    `${normalized}_${year}`,
    `read_${normalized}`,
    `${normalized}_${Math.floor(100 + Math.random() * 900)}`
  ].filter((candidate) => !validateUsername(candidate));
}

export async function usernameExists(prisma: PrismaClient, username: string) {
  const normalized = normalizeUsername(username);
  const existing = await prisma.user.findUnique({
    where: { username: normalized },
    select: { id: true }
  });
  return Boolean(existing);
}

export async function suggestUsernames(prisma: PrismaClient, username: string, limit = 3) {
  const candidates = Array.from(new Set(suggestionCandidates(username))).slice(0, 8);
  if (candidates.length === 0) {
    return [];
  }

  const taken = await prisma.user.findMany({
    where: { username: { in: candidates } },
    select: { username: true }
  });
  const takenSet = new Set(taken.map((user) => user.username));
  return candidates.filter((candidate) => !takenSet.has(candidate)).slice(0, limit);
}

export async function checkUsernameAvailability(prisma: PrismaClient, username: string) {
  const normalizedUsername = normalizeUsername(username);
  const validationReason = validateUsername(normalizedUsername);
  if (validationReason) {
    return {
      username,
      normalizedUsername,
      available: false,
      reason: validationReason,
      suggestions: validationReason === "invalid_format" ? [] : await suggestUsernames(prisma, normalizedUsername)
    };
  }

  const taken = await usernameExists(prisma, normalizedUsername);
  return {
    username,
    normalizedUsername,
    available: !taken,
    reason: taken ? ("taken" as const) : null,
    suggestions: taken ? await suggestUsernames(prisma, normalizedUsername) : []
  };
}
