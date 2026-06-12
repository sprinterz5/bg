import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { runSpamScoringJob } from "../services/spamScoringService.js";

const prisma = new PrismaClient();

try {
  const limit = Number.parseInt(process.env.SPAM_SCORE_LIMIT ?? "200", 10);
  const threshold = Number.parseInt(process.env.SPAM_SCORE_THRESHOLD ?? "70", 10);
  const result = await runSpamScoringJob(prisma, { limit, threshold });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
