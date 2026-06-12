import { Prisma, UserRole } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { adminDashboardHtml } from "../admin/dashboardHtml.js";
import { pageResult, takePlusOne } from "../utils/pagination.js";

const adminPageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional()
});

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const adminOrModerator = app.requireRole([UserRole.ADMIN, UserRole.MODERATOR]);
  const adminOnly = app.requireRole([UserRole.ADMIN]);

  app.get("/admin", async (_request, reply) => {
    return reply.type("text/html").send(adminDashboardHtml());
  });

  app.get("/admin/stats", { preHandler: [adminOrModerator] }, async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      users,
      verifiedUsers,
      activeUsers24h,
      articles,
      pendingArticles,
      reviews,
      pendingReviews,
      openReports,
      activeStories,
      mediaAgg,
      notificationsUnread,
      contentScores
    ] = await Promise.all([
      app.prisma.user.count({ where: { deletedAt: null } }),
      app.prisma.user.count({ where: { deletedAt: null, emailVerified: true } }),
      app.prisma.user.count({ where: { deletedAt: null, lastSeenAt: { gte: since24h } } }),
      app.prisma.article.count({ where: { deletedAt: null } }),
      app.prisma.article.count({ where: { status: "PUBLISHED", moderationStatus: "PENDING", deletedAt: null } }),
      app.prisma.review.count({ where: { deletedAt: null } }),
      app.prisma.review.count({ where: { status: "PUBLISHED", moderationStatus: "PENDING", deletedAt: null } }),
      app.prisma.report.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      app.prisma.story.count({ where: { status: "ACTIVE", expiresAt: { gt: new Date() } } }),
      app.prisma.mediaAsset.aggregate({ _sum: { byteSize: true }, _count: { _all: true } }),
      app.prisma.notification.count({ where: { readAt: null } }),
      app.prisma.contentScore.aggregate({
        _avg: {
          qualityScore: true,
          engagementScore: true,
          trendingScore: true,
          spamScore: true
        },
        _max: { spamScore: true }
      })
    ]);

    return {
      users: {
        total: users,
        verified: verifiedUsers,
        active24h: activeUsers24h
      },
      content: {
        articles,
        pendingArticles,
        reviews,
        pendingReviews,
        activeStories
      },
      safety: {
        openReports,
        unreadNotifications: notificationsUnread,
        avgSpamScore: contentScores._avg.spamScore ?? 0,
        maxSpamScore: contentScores._max.spamScore ?? 0
      },
      media: {
        assets: mediaAgg._count._all,
        bytes: mediaAgg._sum.byteSize ?? 0
      },
      ranking: {
        avgQualityScore: contentScores._avg.qualityScore ?? 0,
        avgEngagementScore: contentScores._avg.engagementScore ?? 0,
        avgTrendingScore: contentScores._avg.trendingScore ?? 0
      }
    };
  });

  app.get("/admin/users", { preHandler: [adminOrModerator] }, async (request) => {
    const query = z
      .object({
        q: z.string().min(1).max(120).optional(),
        role: z.nativeEnum(UserRole).optional(),
        emailVerified: z.coerce.boolean().optional()
      })
      .merge(adminPageSchema)
      .parse(request.query);

    const users = await app.prisma.user.findMany({
      where: {
        ...(query.role ? { role: query.role } : {}),
        ...(query.emailVerified === undefined ? {} : { emailVerified: query.emailVerified }),
        ...(query.q
          ? {
              OR: [
                { username: { contains: query.q, mode: "insensitive" } },
                { displayName: { contains: query.q, mode: "insensitive" } },
                { email: { contains: query.q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      take: takePlusOne(query.limit),
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        displayName: true,
        role: true,
        lastSeenAt: true,
        createdAt: true,
        deletedAt: true,
        _count: {
          select: {
            authoredArticles: true,
            authoredReviews: true,
            reportsFiled: true
          }
        }
      }
    });

    return pageResult(users, query.limit);
  });

  app.get("/admin/content-scores", { preHandler: [adminOrModerator] }, async (request) => {
    const query = z
      .object({
        sort: z.enum(["spam", "quality", "trending", "engagement"]).default("spam")
      })
      .merge(adminPageSchema)
      .parse(request.query);

    const orderBy =
      query.sort === "quality"
        ? { qualityScore: "desc" as const }
        : query.sort === "trending"
          ? { trendingScore: "desc" as const }
          : query.sort === "engagement"
            ? { engagementScore: "desc" as const }
            : { spamScore: "desc" as const };

    const scores = await app.prisma.contentScore.findMany({
      take: takePlusOne(query.limit),
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy,
    });

    const articleIds = scores.filter((score) => score.targetType === "ARTICLE").map((score) => score.targetId);
    const reviewIds = scores.filter((score) => score.targetType === "REVIEW").map((score) => score.targetId);
    const [articles, reviews] = await Promise.all([
      app.prisma.article.findMany({
        where: { id: { in: articleIds } },
        select: { id: true, title: true, authorId: true, status: true, moderationStatus: true }
      }),
      app.prisma.review.findMany({
        where: { id: { in: reviewIds } },
        select: { id: true, title: true, authorId: true, status: true, moderationStatus: true, book: { select: { title: true } } }
      })
    ]);
    const articleMap = new Map(articles.map((article) => [article.id, article]));
    const reviewMap = new Map(reviews.map((review) => [review.id, review]));

    return pageResult(
      scores.map((score) => ({
        ...score,
        totalDwellMs: score.totalDwellMs.toString(),
        content: score.targetType === "ARTICLE" ? articleMap.get(score.targetId) ?? null : reviewMap.get(score.targetId) ?? null
      })),
      query.limit
    );
  });

  app.get("/admin/job-runs", { preHandler: [adminOrModerator] }, async (request) => {
    const query = z
      .object({
        name: z.string().min(1).max(120).optional(),
        status: z.enum(["RUNNING", "SUCCEEDED", "FAILED"]).optional()
      })
      .merge(adminPageSchema)
      .parse(request.query);

    const runs = await app.prisma.jobRun.findMany({
      where: {
        ...(query.name ? { name: query.name } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      take: takePlusOne(query.limit),
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { startedAt: "desc" }
    });

    return pageResult(runs, query.limit);
  });

  app.patch("/admin/users/:id/role", { preHandler: [adminOnly] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ role: z.nativeEnum(UserRole) }).parse(request.body);
    if (id === request.user.sub && body.role !== UserRole.ADMIN) {
      throw reply.badRequest("You cannot remove your own admin role");
    }

    const [updated] = await app.prisma.$transaction([
      app.prisma.user.update({
        where: { id },
        data: { role: body.role },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          updatedAt: true
        }
      }),
      // Revoke all active refresh tokens so the role change takes effect
      // immediately; otherwise the demoted user retains elevated access until
      // their access tokens expire (up to 15 minutes).
      app.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);

    return updated;
  });
};
