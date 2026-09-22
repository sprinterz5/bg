import type { FastifyInstance } from "fastify";
import { recomputeSimilarBooks } from "./bookSimilarityService.js";

export async function expireOldStories(app: FastifyInstance) {
  const result = await app.prisma.story.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: new Date() }
    },
    data: {
      status: "EXPIRED"
    }
  });

  return { expiredStories: result.count };
}

export async function recomputeRecentBookSimilarities(app: FastifyInstance, limit = 50) {
  const books = await app.prisma.book.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true }
  });

  let recomputed = 0;
  for (const book of books) {
    await recomputeSimilarBooks(app, book.id, 25);
    recomputed += 1;
  }

  return { recomputedBooks: recomputed };
}

export async function runMaintenanceJobs(app: FastifyInstance, options: { bookLimit?: number } = {}) {
  const [stories, books] = await Promise.all([
    expireOldStories(app),
    recomputeRecentBookSimilarities(app, options.bookLimit ?? 50)
  ]);

  return {
    ...stories,
    ...books
  };
}
