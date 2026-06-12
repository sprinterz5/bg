import type { ContentScoreTargetType, PrismaClient } from "@prisma/client";

type SpamJobOptions = {
  limit?: number;
  threshold?: number;
};

type ScorableContent = {
  targetType: ContentScoreTargetType;
  id: string;
  authorId: string;
  title: string;
  body: string;
  tags: string[];
  readingTimeMinutes: number;
  createdAt: Date;
  publishedAt: Date | null;
  author: {
    createdAt: Date;
    emailVerified: boolean;
  };
};

type SpamSignal = {
  name: string;
  weight: number;
  value?: number | string | boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function countLinks(text: string) {
  return text.match(/https?:\/\/|www\./gi)?.length ?? 0;
}

function repeatedTagCount(tags: string[]) {
  const normalized = tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  return normalized.length - new Set(normalized).size;
}

function hasRepeatedCharacters(text: string) {
  return /(.)\1{8,}/.test(text);
}

function titleKey(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

async function scoreContent(prisma: PrismaClient, content: ScorableContent, threshold: number) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const signals: SpamSignal[] = [];

  const [contentScore, reportCount, duplicateTitleCount, authorArticleCount, authorReviewCount] = await Promise.all([
    prisma.contentScore.findUnique({
      where: {
        targetType_targetId: {
          targetType: content.targetType,
          targetId: content.id
        }
      }
    }),
    prisma.report.count({
      where: {
        targetType: content.targetType,
        targetId: content.id,
        status: { in: ["OPEN", "UNDER_REVIEW"] }
      }
    }),
    content.targetType === "ARTICLE"
      ? prisma.article.count({
          where: {
            id: { not: content.id },
            title: { equals: content.title, mode: "insensitive" },
            deletedAt: null
          }
        })
      : prisma.review.count({
          where: {
            id: { not: content.id },
            title: { equals: content.title, mode: "insensitive" },
            deletedAt: null
          }
        }),
    prisma.article.count({
      where: {
        authorId: content.authorId,
        createdAt: { gte: since24h },
        deletedAt: null
      }
    }),
    prisma.review.count({
      where: {
        authorId: content.authorId,
        createdAt: { gte: since24h },
        deletedAt: null
      }
    })
  ]);

  const bodyLength = content.body.trim().length;
  const links = countLinks(content.body);
  const duplicateTags = repeatedTagCount(content.tags);
  const accountAgeHours = Math.max(0, (Date.now() - content.author.createdAt.getTime()) / 36e5);
  const hides = contentScore?.hides ?? 0;
  const impressions = Math.max(contentScore?.impressions ?? 0, 1);
  const reports = Math.max(contentScore?.reports ?? 0, reportCount);
  const hideRate = hides / impressions;
  const reportRate = reports / impressions;
  const authorPostVelocity = authorArticleCount + authorReviewCount;

  if (!content.author.emailVerified) {
    signals.push({ name: "author_email_unverified", weight: 8, value: true });
  }
  if (accountAgeHours < 24) {
    signals.push({ name: "new_account", weight: 8, value: Math.round(accountAgeHours) });
  }
  if (bodyLength < 350) {
    signals.push({ name: "low_effort_body", weight: 14, value: bodyLength });
  }
  if (content.readingTimeMinutes <= 1 && bodyLength < 700) {
    signals.push({ name: "very_short_read", weight: 7, value: content.readingTimeMinutes });
  }
  if (links >= 3) {
    signals.push({ name: "high_link_density", weight: Math.min(links * 5, 25), value: links });
  }
  if (duplicateTags > 0) {
    signals.push({ name: "duplicate_tags", weight: duplicateTags * 4, value: duplicateTags });
  }
  if (hasRepeatedCharacters(content.body)) {
    signals.push({ name: "repeated_characters", weight: 10, value: true });
  }
  if (duplicateTitleCount > 0) {
    signals.push({ name: "duplicate_title", weight: Math.min(duplicateTitleCount * 12, 30), value: duplicateTitleCount });
  }
  if (authorPostVelocity > 8) {
    signals.push({ name: "high_post_velocity_24h", weight: Math.min((authorPostVelocity - 8) * 4, 32), value: authorPostVelocity });
  }
  if (reports > 0) {
    signals.push({ name: "open_reports", weight: Math.min(reports * 18, 54), value: reports });
  }
  if (hideRate > 0.08) {
    signals.push({ name: "high_hide_rate", weight: Math.min(hideRate * 160, 40), value: Number(hideRate.toFixed(3)) });
  }
  if (reportRate > 0.02) {
    signals.push({ name: "high_report_rate", weight: Math.min(reportRate * 260, 60), value: Number(reportRate.toFixed(3)) });
  }

  const rawScore = signals.reduce((score, signal) => score + signal.weight, 0);
  const positiveEngagement =
    ((contentScore?.likes ?? 0) + (contentScore?.saves ?? 0) * 1.5 + (contentScore?.comments ?? 0) * 0.6) /
    impressions;
  const spamScore = clamp(rawScore - Math.min(positiveEngagement * 45, 20));

  const updatedScore = await prisma.contentScore.upsert({
    where: {
      targetType_targetId: {
        targetType: content.targetType,
        targetId: content.id
      }
    },
    create: {
      targetType: content.targetType,
      targetId: content.id,
      spamScore,
      qualityScore: clamp(50 - spamScore * 0.45),
      trendingScore: clamp(25 - spamScore * 0.35),
      reports
    },
    update: {
      spamScore,
      qualityScore: clamp((contentScore?.qualityScore ?? 50) - spamScore * 0.25),
      trendingScore: clamp((contentScore?.trendingScore ?? 25) - spamScore * 0.2),
      reports
    }
  });

  if (spamScore >= threshold) {
    await prisma.exploreItem.upsert({
      where: {
        targetType_targetId: {
          targetType: content.targetType,
          targetId: content.id
        }
      },
      create: {
        targetType: content.targetType,
        targetId: content.id,
        moderationStatus: "PENDING",
        score: 0,
        reason: `spam_score:${Math.round(spamScore)}:${signals.map((signal) => signal.name).join(",")}`
      },
      update: {
        moderationStatus: "PENDING",
        score: 0,
        reason: `spam_score:${Math.round(spamScore)}:${signals.map((signal) => signal.name).join(",")}`
      }
    });
  }

  return {
    targetType: content.targetType,
    targetId: content.id,
    title: content.title,
    spamScore: updatedScore.spamScore,
    thresholdExceeded: spamScore >= threshold,
    signals,
    normalizedTitle: titleKey(content.title)
  };
}

export async function runSpamScoringJob(prisma: PrismaClient, options: SpamJobOptions = {}) {
  const limit = options.limit ?? 200;
  const threshold = options.threshold ?? 70;

  const [articles, reviews] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        moderationStatus: { in: ["APPROVED", "PENDING"] },
        deletedAt: null
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        author: { select: { createdAt: true, emailVerified: true } }
      }
    }),
    prisma.review.findMany({
      where: {
        status: "PUBLISHED",
        moderationStatus: { in: ["APPROVED", "PENDING"] },
        deletedAt: null
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        author: { select: { createdAt: true, emailVerified: true } }
      }
    })
  ]);

  const contents: ScorableContent[] = [
    ...articles.map((article) => ({
      targetType: "ARTICLE" as const,
      id: article.id,
      authorId: article.authorId,
      title: article.title,
      body: article.body,
      tags: article.tags,
      readingTimeMinutes: article.readingTimeMinutes,
      createdAt: article.createdAt,
      publishedAt: article.publishedAt,
      author: article.author
    })),
    ...reviews.map((review) => ({
      targetType: "REVIEW" as const,
      id: review.id,
      authorId: review.authorId,
      title: review.title,
      body: review.body,
      tags: review.tags,
      readingTimeMinutes: review.readingTimeMinutes,
      createdAt: review.createdAt,
      publishedAt: review.publishedAt,
      author: review.author
    }))
  ];

  const results = [];
  for (const content of contents) {
    results.push(await scoreContent(prisma, content, threshold));
  }

  const flagged = results.filter((result) => result.thresholdExceeded);
  return {
    scanned: results.length,
    flagged: flagged.length,
    threshold,
    data: results.sort((a, b) => b.spamScore - a.spamScore).slice(0, 50)
  };
}
