import { PrismaClient } from "@prisma/client";

type IdRank = {
  id: string;
  rank: number;
};

function uniqueIds(rows: IdRank[]) {
  return [...new Map(rows.map((row) => [row.id, row.rank])).keys()];
}

export async function fuzzyUserIds(prisma: PrismaClient, query: string, limit: number, hiddenIds: string[]) {
  if (query.length < 3) {
    return [];
  }

  const rows = await prisma.$queryRaw<IdRank[]>`
    SELECT id::text, similarity(
      lower(coalesce(username, '') || ' ' || coalesce("displayName", '') || ' ' || coalesce(bio, '')),
      lower(${query})
    ) AS rank
    FROM "User"
    WHERE "deletedAt" IS NULL
      AND id::text <> ALL(${hiddenIds})
      AND (
        lower(coalesce(username, '') || ' ' || coalesce("displayName", '') || ' ' || coalesce(bio, '')) % lower(${query})
        OR lower(coalesce(username, '') || ' ' || coalesce("displayName", '') || ' ' || coalesce(bio, '')) LIKE '%' || lower(${query}) || '%'
      )
    ORDER BY rank DESC, "createdAt" DESC
    LIMIT ${limit}
  `;
  return uniqueIds(rows);
}

export async function fuzzyBookIds(prisma: PrismaClient, query: string, limit: number) {
  if (query.length < 3) {
    return [];
  }

  const rows = await prisma.$queryRaw<IdRank[]>`
    SELECT id::text, similarity(
      lower(coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(isbn10, '') || ' ' || coalesce(isbn13, '') || ' ' || coalesce(publisher, '')),
      lower(${query})
    ) AS rank
    FROM "Book"
    WHERE
      lower(coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(isbn10, '') || ' ' || coalesce(isbn13, '') || ' ' || coalesce(publisher, '')) % lower(${query})
      OR lower(coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(isbn10, '') || ' ' || coalesce(isbn13, '') || ' ' || coalesce(publisher, '')) LIKE '%' || lower(${query}) || '%'
      OR "authors" && ARRAY[${query}]::text[]
      OR "categories" && ARRAY[${query}]::text[]
    ORDER BY rank DESC, "updatedAt" DESC
    LIMIT ${limit}
  `;
  return uniqueIds(rows);
}

export async function fuzzyArticleIds(prisma: PrismaClient, query: string, limit: number, hiddenAuthorIds: string[]) {
  if (query.length < 3) {
    return [];
  }

  const rows = await prisma.$queryRaw<IdRank[]>`
    SELECT id::text, similarity(
      lower(coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(body, '')),
      lower(${query})
    ) AS rank
    FROM "Article"
    WHERE status = 'PUBLISHED'
      AND "moderationStatus" = 'APPROVED'
      AND "deletedAt" IS NULL
      AND "authorId"::text <> ALL(${hiddenAuthorIds})
      AND (
        lower(coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(body, '')) % lower(${query})
        OR lower(coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(body, '')) LIKE '%' || lower(${query}) || '%'
        OR "tags" && ARRAY[${query}]::text[]
      )
    ORDER BY rank DESC, "publishedAt" DESC
    LIMIT ${limit}
  `;
  return uniqueIds(rows);
}

export async function fuzzyReviewIds(prisma: PrismaClient, query: string, limit: number, hiddenAuthorIds: string[]) {
  if (query.length < 3) {
    return [];
  }

  const rows = await prisma.$queryRaw<IdRank[]>`
    SELECT r.id::text, GREATEST(
      similarity(lower(coalesce(r.title, '') || ' ' || coalesce(r.body, '')), lower(${query})),
      similarity(lower(coalesce(b.title, '') || ' ' || coalesce(b.subtitle, '')), lower(${query}))
    ) AS rank
    FROM "Review" r
    JOIN "Book" b ON b.id = r."bookId"
    WHERE r.status = 'PUBLISHED'
      AND r."moderationStatus" = 'APPROVED'
      AND r."deletedAt" IS NULL
      AND r."authorId"::text <> ALL(${hiddenAuthorIds})
      AND (
        lower(coalesce(r.title, '') || ' ' || coalesce(r.body, '')) % lower(${query})
        OR lower(coalesce(b.title, '') || ' ' || coalesce(b.subtitle, '')) % lower(${query})
        OR lower(coalesce(r.title, '') || ' ' || coalesce(r.body, '') || ' ' || coalesce(b.title, '')) LIKE '%' || lower(${query}) || '%'
        OR r."tags" && ARRAY[${query}]::text[]
      )
    ORDER BY rank DESC, r."publishedAt" DESC
    LIMIT ${limit}
  `;
  return uniqueIds(rows);
}
