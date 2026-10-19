import type { PrismaClient } from "@prisma/client";

// AutoLayouted-23: a new account finds one unread chat from "Thoughts" with a welcome message.
const SYSTEM_USERNAME = "thoughts";
const WELCOME =
  "welcome to the Thoughts! Here friends share what they learn: short articles, stories and ideas worth your time. " +
  "Follow people you like, write your first article and get smarter together.";

/** Creates the system account if missing and opens a direct chat from it with the welcome message. Never throws. */
export async function sendWelcomeChat(prisma: PrismaClient, userId: string) {
  try {
    const system = await prisma.user.upsert({
      where: { username: SYSTEM_USERNAME },
      update: {},
      create: { username: SYSTEM_USERNAME, displayName: "Thoughts" }
    });
    if (system.id === userId) return;
    const key = [system.id, userId].sort().join(":");
    await prisma.conversation.upsert({
      where: { directKey: key },
      update: {},
      create: {
        type: "DIRECT",
        directKey: key,
        members: { create: [{ userId: system.id, lastReadAt: new Date() }, { userId }] },
        messages: { create: { senderId: system.id, type: "TEXT", body: WELCOME } }
      }
    });
  } catch {
    // a missing welcome chat must not fail the signup
  }
}
