import type { Book } from "@prisma/client";
import type { FastifyInstance } from "fastify";

type SimilarBookResult = {
  id: string;
  score: number;
  reasons: string[];
  book: Book;
  updatedAt: Date;
};

function pairFor(bookId: string, otherBookId: string) {
  return bookId < otherBookId
    ? { bookAId: bookId, bookBId: otherBookId }
    : { bookAId: otherBookId, bookBId: bookId };
}

function overlap(left: string[], right: string[]) {
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  return left.filter((value) => rightSet.has(value.toLowerCase()));
}

function scoreBooks(base: Book, other: Book) {
  const sharedAuthors = overlap(base.authors, other.authors);
  const sharedCategories = overlap(base.categories, other.categories);
  const reasons: string[] = [];
  let score = 0;

  if (sharedAuthors.length > 0) {
    score += Math.min(sharedAuthors.length * 0.35, 0.55);
    reasons.push(`shared_authors:${sharedAuthors.join(",")}`);
  }

  if (sharedCategories.length > 0) {
    score += Math.min(sharedCategories.length * 0.12, 0.35);
    reasons.push(`shared_categories:${sharedCategories.join(",")}`);
  }

  if (base.language && other.language && base.language === other.language) {
    score += 0.04;
    reasons.push(`same_language:${base.language}`);
  }

  if (base.publisher && other.publisher && base.publisher === other.publisher) {
    score += 0.04;
    reasons.push(`same_publisher:${base.publisher}`);
  }

  return { score: Math.min(score, 1), reasons };
}

export async function recomputeSimilarBooks(
  app: FastifyInstance,
  bookId: string,
  limit = 25
): Promise<SimilarBookResult[] | null> {
  const base = await app.prisma.book.findUnique({ where: { id: bookId } });
  if (!base) {
    return null;
  }

  const [baseShelfUsers, baseReviewUsers] = await Promise.all([
    app.prisma.shelfItem.findMany({
      where: { bookId },
      select: { userId: true }
    }),
    app.prisma.review.findMany({
      where: { bookId, status: "PUBLISHED", moderationStatus: "APPROVED", deletedAt: null },
      select: { authorId: true }
    })
  ]);
  const engagedUserIds = [
    ...new Set([...baseShelfUsers.map((row) => row.userId), ...baseReviewUsers.map((row) => row.authorId)])
  ];

  const [metadataCandidates, coShelfRows, coReviewRows] = await Promise.all([
    app.prisma.book.findMany({
    where: {
      id: { not: bookId },
      OR: [
        ...(base.authors.length > 0 ? [{ authors: { hasSome: base.authors } }] : []),
        ...(base.categories.length > 0 ? [{ categories: { hasSome: base.categories } }] : []),
        ...(base.language ? [{ language: base.language }] : [])
      ]
    },
    take: 300,
    orderBy: { updatedAt: "desc" }
    }),
    engagedUserIds.length === 0
      ? Promise.resolve([])
      : app.prisma.shelfItem.groupBy({
          by: ["bookId"],
          where: {
            userId: { in: engagedUserIds },
            bookId: { not: bookId }
          },
          _count: { _all: true },
          orderBy: { _count: { bookId: "desc" } },
          take: 200
        }),
    engagedUserIds.length === 0
      ? Promise.resolve([])
      : app.prisma.review.groupBy({
          by: ["bookId"],
          where: {
            authorId: { in: engagedUserIds },
            bookId: { not: bookId },
            status: "PUBLISHED",
            moderationStatus: "APPROVED",
            deletedAt: null
          },
          _count: { _all: true },
          orderBy: { _count: { bookId: "desc" } },
          take: 200
        })
  ]);

  const coBookIds = new Set([...coShelfRows.map((row) => row.bookId), ...coReviewRows.map((row) => row.bookId)]);
  const metadataIds = new Set(metadataCandidates.map((candidate) => candidate.id));
  const coOnlyBooks =
    coBookIds.size === 0
      ? []
      : await app.prisma.book.findMany({
          where: {
            id: { in: [...coBookIds].filter((id) => !metadataIds.has(id)) }
          }
        });
  const candidates = [...metadataCandidates, ...coOnlyBooks];
  const coShelfMap = new Map(coShelfRows.map((row) => [row.bookId, row._count._all]));
  const coReviewMap = new Map(coReviewRows.map((row) => [row.bookId, row._count._all]));

  const scored = candidates
    .map((candidate) => {
      const baseScore = scoreBooks(base, candidate);
      const coShelfCount = coShelfMap.get(candidate.id) ?? 0;
      const coReviewCount = coReviewMap.get(candidate.id) ?? 0;
      const collaborativeScore = Math.min(coShelfCount * 0.045 + coReviewCount * 0.08, 0.45);
      const reasons = [...baseScore.reasons];
      if (coShelfCount > 0) {
        reasons.push(`shared_shelf_users:${coShelfCount}`);
      }
      if (coReviewCount > 0) {
        reasons.push(`shared_review_users:${coReviewCount}`);
      }

      return {
        book: candidate,
        score: Math.min(baseScore.score + collaborativeScore, 1),
        reasons
      };
    })
    .filter((item) => item.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  await Promise.all(
    scored.map((item) => {
      const pair = pairFor(bookId, item.book.id);
      return app.prisma.bookSimilarity.upsert({
        where: { bookAId_bookBId: pair },
        create: {
          ...pair,
          score: item.score,
          reasons: item.reasons
        },
        update: {
          score: item.score,
          reasons: item.reasons
        }
      });
    })
  );

  return getSimilarBooks(app, bookId, limit);
}

export async function getSimilarBooks(
  app: FastifyInstance,
  bookId: string,
  limit = 10
): Promise<SimilarBookResult[] | null> {
  const rows = await app.prisma.bookSimilarity.findMany({
    where: {
      OR: [{ bookAId: bookId }, { bookBId: bookId }]
    },
    orderBy: { score: "desc" },
    take: limit,
    include: {
      bookA: true,
      bookB: true
    }
  });

  if (rows.length === 0) {
    return recomputeSimilarBooks(app, bookId, Math.max(limit, 25));
  }

  return rows.map((row) => ({
    id: row.id,
    score: row.score,
    reasons: row.reasons,
    book: row.bookAId === bookId ? row.bookB : row.bookA,
    updatedAt: row.updatedAt
  }));
}
