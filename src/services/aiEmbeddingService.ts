import type { AiEmbeddingTargetType } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { sha256 } from "../utils/hash.js";
import { aiReadiness, createEmbedding } from "./aiProviderService.js";

type EmbeddingTarget = {
  targetType: AiEmbeddingTargetType;
  targetId: string;
  text: string;
};

type BackfillOptions = {
  limit?: number;
  targetTypes?: AiEmbeddingTargetType[];
};

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function articleText(article: {
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  body: string;
  tags: string[];
}) {
  return compactText([
    `Title: ${article.title}`,
    article.subtitle ? `Subtitle: ${article.subtitle}` : "",
    article.excerpt ? `Excerpt: ${article.excerpt}` : "",
    `Tags: ${article.tags.join(", ")}`,
    `Body: ${article.body}`
  ].filter(Boolean).join("\n"));
}

function reviewText(review: {
  title: string;
  body: string;
  tags: string[];
  rating: number | null;
  book: {
    title: string;
    subtitle: string | null;
    authors: string[];
    categories: string[];
  };
}) {
  return compactText([
    `Review: ${review.title}`,
    `Book: ${review.book.title}`,
    review.book.subtitle ? `Book subtitle: ${review.book.subtitle}` : "",
    `Authors: ${review.book.authors.join(", ")}`,
    `Categories: ${review.book.categories.join(", ")}`,
    review.rating ? `Rating: ${review.rating}` : "",
    `Tags: ${review.tags.join(", ")}`,
    `Body: ${review.body}`
  ].filter(Boolean).join("\n"));
}

function bookText(book: {
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  categories: string[];
  publisher: string | null;
  language: string | null;
}) {
  return compactText([
    `Book: ${book.title}`,
    book.subtitle ? `Subtitle: ${book.subtitle}` : "",
    `Authors: ${book.authors.join(", ")}`,
    `Categories: ${book.categories.join(", ")}`,
    book.publisher ? `Publisher: ${book.publisher}` : "",
    book.language ? `Language: ${book.language}` : "",
    book.description ? `Description: ${book.description}` : ""
  ].filter(Boolean).join("\n"));
}

async function collectTargets(app: FastifyInstance, options: Required<BackfillOptions>) {
  const perTypeLimit = Math.max(1, options.limit);
  const wants = new Set(options.targetTypes);
  const [articles, reviews, books] = await Promise.all([
    wants.has("ARTICLE")
      ? app.prisma.article.findMany({
          where: { status: "PUBLISHED", moderationStatus: "APPROVED", deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: perTypeLimit
        })
      : Promise.resolve([]),
    wants.has("REVIEW")
      ? app.prisma.review.findMany({
          where: { status: "PUBLISHED", moderationStatus: "APPROVED", deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: perTypeLimit,
          include: { book: true }
        })
      : Promise.resolve([]),
    wants.has("BOOK")
      ? app.prisma.book.findMany({
          orderBy: { updatedAt: "desc" },
          take: perTypeLimit
        })
      : Promise.resolve([])
  ]);

  const targets: EmbeddingTarget[] = [
    ...articles.map((article) => ({
      targetType: "ARTICLE" as const,
      targetId: article.id,
      text: articleText(article)
    })),
    ...reviews.map((review) => ({
      targetType: "REVIEW" as const,
      targetId: review.id,
      text: reviewText(review)
    })),
    ...books.map((book) => ({
      targetType: "BOOK" as const,
      targetId: book.id,
      text: bookText(book)
    }))
  ];

  return targets.slice(0, options.limit);
}

export async function runAiEmbeddingBackfill(app: FastifyInstance, options: BackfillOptions = {}) {
  const readiness = aiReadiness();
  const limit = options.limit ?? env.JOB_AI_EMBEDDINGS_LIMIT;
  const targetTypes = options.targetTypes ?? ["ARTICLE", "REVIEW", "BOOK"];

  if (!readiness.ready) {
    return {
      enabled: readiness.enabled,
      ready: readiness.ready,
      skipped: true,
      reason: readiness.enabled ? `missing:${readiness.missing.join(",")}` : "ai_disabled",
      generated: 0,
      failed: 0
    };
  }

  const targets = await collectTargets(app, { limit, targetTypes });
  let generated = 0;
  let unchanged = 0;
  let failed = 0;
  const failures: Array<{ targetType: AiEmbeddingTargetType; targetId: string; error: string }> = [];

  for (const target of targets) {
    const inputHash = sha256(target.text);
    const existing = await app.prisma.aiEmbedding.findUnique({
      where: {
        targetType_targetId_model: {
          targetType: target.targetType,
          targetId: target.targetId,
          model: env.AI_EMBEDDING_MODEL
        }
      },
      select: { inputHash: true, status: true }
    });

    if (existing?.inputHash === inputHash && existing.status === "READY") {
      unchanged += 1;
      continue;
    }

    await app.prisma.aiEmbedding.upsert({
      where: {
        targetType_targetId_model: {
          targetType: target.targetType,
          targetId: target.targetId,
          model: env.AI_EMBEDDING_MODEL
        }
      },
      create: {
        targetType: target.targetType,
        targetId: target.targetId,
        provider: env.AI_PROVIDER,
        model: env.AI_EMBEDDING_MODEL,
        dimensions: env.AI_EMBEDDING_DIMENSIONS,
        inputHash,
        textPreview: target.text.slice(0, 500),
        status: "PENDING"
      },
      update: {
        provider: env.AI_PROVIDER,
        dimensions: env.AI_EMBEDDING_DIMENSIONS,
        inputHash,
        textPreview: target.text.slice(0, 500),
        status: "PENDING",
        error: null
      }
    });

    try {
      const vector = await createEmbedding({ input: target.text });
      await app.prisma.aiEmbedding.update({
        where: {
          targetType_targetId_model: {
            targetType: target.targetType,
            targetId: target.targetId,
            model: env.AI_EMBEDDING_MODEL
          }
        },
        data: {
          vector,
          dimensions: vector.length,
          status: "READY",
          error: null,
          embeddedAt: new Date()
        }
      });
      generated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await app.prisma.aiEmbedding.update({
        where: {
          targetType_targetId_model: {
            targetType: target.targetType,
            targetId: target.targetId,
            model: env.AI_EMBEDDING_MODEL
          }
        },
        data: {
          status: "FAILED",
          error: message
        }
      });
      failures.push({ targetType: target.targetType, targetId: target.targetId, error: message });
      failed += 1;
    }
  }

  return {
    enabled: readiness.enabled,
    ready: readiness.ready,
    provider: readiness.provider,
    model: readiness.model,
    dimensions: readiness.dimensions,
    scanned: targets.length,
    generated,
    unchanged,
    failed,
    failures: failures.slice(0, 20)
  };
}

export async function getAiEmbeddingStats(app: FastifyInstance) {
  const [total, ready, failed, byTarget] = await Promise.all([
    app.prisma.aiEmbedding.count(),
    app.prisma.aiEmbedding.count({ where: { status: "READY" } }),
    app.prisma.aiEmbedding.count({ where: { status: "FAILED" } }),
    app.prisma.aiEmbedding.groupBy({
      by: ["targetType", "status"],
      _count: { _all: true }
    })
  ]);

  return {
    total,
    ready,
    failed,
    byTarget: byTarget.map((row) => ({
      targetType: row.targetType,
      status: row.status,
      count: row._count._all
    }))
  };
}
