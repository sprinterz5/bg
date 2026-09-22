import { ReportReason, ReportResolution, ReportStatus, ReportTargetType, UserRole } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPagination, pageResult, takePlusOne } from "../utils/pagination.js";
import { createNotification } from "../services/notificationService.js";
import { incrementContentScore } from "../services/contentScoreService.js";
import { incrementContentCounter } from "../services/counterService.js";
import { withIdempotency } from "../services/idempotencyService.js";
import { endpointRateLimit } from "../services/rateLimitService.js";

const reportCreateSchema = z.object({
  targetType: z.nativeEnum(ReportTargetType),
  targetId: z.string().uuid(),
  reason: z.nativeEnum(ReportReason),
  details: z.string().max(4000).optional()
});

const reportUpdateSchema = z.object({
  status: z.nativeEnum(ReportStatus).optional(),
  resolution: z.nativeEnum(ReportResolution).nullable().optional(),
  moderatorNote: z.string().max(4000).nullable().optional()
});

async function assertReportTargetExists(app: any, targetType: ReportTargetType, targetId: string) {
  switch (targetType) {
    case "USER":
      return Boolean(await app.prisma.user.findFirst({ where: { id: targetId, deletedAt: null } }));
    case "ARTICLE":
      return Boolean(await app.prisma.article.findFirst({ where: { id: targetId, deletedAt: null } }));
    case "REVIEW":
      return Boolean(await app.prisma.review.findFirst({ where: { id: targetId, deletedAt: null } }));
    case "STORY":
      return Boolean(await app.prisma.story.findFirst({ where: { id: targetId, deletedAt: null } }));
    case "MESSAGE":
      return Boolean(await app.prisma.message.findFirst({ where: { id: targetId, deletedAt: null } }));
    case "NOTE":
      return Boolean(await app.prisma.note.findFirst({ where: { id: targetId } }));
    case "COMMENT":
      return Boolean(await app.prisma.comment.findFirst({ where: { id: targetId, deletedAt: null } }));
    default:
      return false;
  }
}

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.post("/reports", { preHandler: [app.authenticate, endpointRateLimit({ key: "reports", limit: 20, windowSeconds: 60, by: "userOrIp" })] }, async (request, reply) => {
    const result = await withIdempotency(request, reply, async () => {
    const body = reportCreateSchema.parse(request.body);

    if (body.targetType === "USER" && body.targetId === request.user.sub) {
      throw reply.badRequest("You cannot report yourself");
    }

    const exists = await assertReportTargetExists(app, body.targetType, body.targetId);
    if (!exists) {
      throw reply.notFound("Reported target not found");
    }

    // Detect create vs update before the upsert so the report counter is only
    // incremented on the first report. Incrementing on every re-report would
    // let a single actor suppress any content by repeatedly reporting it.
    const existingReport = await app.prisma.report.findUnique({
      where: {
        reporterId_targetType_targetId: {
          reporterId: request.user.sub,
          targetType: body.targetType,
          targetId: body.targetId
        }
      },
      select: { id: true }
    });

    const report = await app.prisma.report.upsert({
      where: {
        reporterId_targetType_targetId: {
          reporterId: request.user.sub,
          targetType: body.targetType,
          targetId: body.targetId
        }
      },
      update: {
        reason: body.reason,
        details: body.details,
        status: "OPEN",
        resolution: null,
        moderatorId: null,
        moderatorNote: null,
        resolvedAt: null
      },
      create: {
        reporterId: request.user.sub,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        details: body.details
      }
    });

    if (!existingReport) {
      await incrementContentScore(app, body.targetType, body.targetId, { reports: 1 });
      await incrementContentCounter(app, body.targetType, body.targetId, { reports: 1 });
    }

      return { statusCode: 201, body: report };
    });

    return reply.status(result.statusCode ?? 201).send(result.body);
  });

  app.get("/me/reports", { preHandler: [app.authenticate] }, async (request) => {
    const { limit, cursor } = getPagination(request.query);
    const reports = await app.prisma.report.findMany({
      where: { reporterId: request.user.sub },
      take: takePlusOne(limit),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "desc" }
    });

    return pageResult(reports, limit);
  });

  app.get("/reports", { preHandler: [app.requireRole([UserRole.MODERATOR, UserRole.ADMIN])] }, async (request) => {
    const query = z
      .object({
        status: z.nativeEnum(ReportStatus).optional()
      })
      .merge(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.string().optional() }))
      .parse(request.query);

    const reports = await app.prisma.report.findMany({
      where: query.status ? { status: query.status } : {},
      take: takePlusOne(query.limit),
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        reporter: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        moderator: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
      }
    });

    return pageResult(reports, query.limit);
  });

  app.patch("/reports/:id", { preHandler: [app.requireRole([UserRole.MODERATOR, UserRole.ADMIN])] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = reportUpdateSchema.parse(request.body);
    const existing = await app.prisma.report.findUnique({ where: { id } });
    if (!existing) {
      throw reply.notFound("Report not found");
    }

    const resolved = body.status === "RESOLVED" || body.status === "DISMISSED";
    const report = await app.prisma.report.update({
      where: { id },
      data: {
        status: body.status,
        resolution: body.resolution,
        moderatorNote: body.moderatorNote,
        moderatorId: request.user.sub,
        ...(resolved ? { resolvedAt: new Date() } : {})
      }
    });

    if (resolved) {
      await createNotification(app, {
        userId: report.reporterId,
        type: "REPORT_RESOLVED",
        targetType: "REPORT",
        targetId: report.id,
        title: "Report updated",
        body: report.status === "RESOLVED" ? "Your report was reviewed and resolved." : "Your report was reviewed.",
        data: { status: report.status, resolution: report.resolution }
      });
    }

    return report;
  });
};
