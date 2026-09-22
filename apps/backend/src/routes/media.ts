import { MediaKind } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { saveMultipartFile, UnsupportedMediaTypeError } from "../services/mediaService.js";
import { endpointRateLimit } from "../services/rateLimitService.js";
import { withIdempotency } from "../services/idempotencyService.js";
import { moderateMediaAsset } from "../services/mediaModerationService.js";

export const mediaRoutes: FastifyPluginAsync = async (app) => {
  app.post("/media/upload-url", { preHandler: [app.authenticate, endpointRateLimit({ key: "media-upload-url", limit: 120, windowSeconds: 60, by: "userOrIp" })] }, async (request, reply) => {
    const body = z.object({
      kind: z.nativeEnum(MediaKind),
      contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      byteSize: z.number().int().positive().max(10 * 1024 * 1024),
      checksum: z.string().max(200).optional()
    }).parse(request.body);

    if (process.env.MEDIA_STORAGE_PROVIDER === "LOCAL" || !process.env.MEDIA_STORAGE_PROVIDER) {
      return reply.status(501).send({
        error: "direct_upload_not_available",
        message: "Direct upload URLs are only available for R2/S3 storage. Use POST /media for local storage.",
        fallback: {
          method: "POST",
          url: "/media",
          multipart: true,
          kind: body.kind
        }
      });
    }

    return reply.status(501).send({
      error: "direct_upload_not_implemented",
      message: "Direct upload contract is reserved for R2/S3 and will be enabled when media credentials are configured."
    });
  });

  app.post("/media", { preHandler: [app.authenticate, endpointRateLimit({ key: "media-upload", limit: 30, windowSeconds: 60, by: "userOrIp" })] }, async (request, reply) => {
    const result = await withIdempotency(request, reply, async () => {
    const file = await request.file();
    if (!file) {
      throw reply.badRequest("File is required");
    }

    const kindValue = typeof file.fields.kind === "object" && "value" in file.fields.kind ? file.fields.kind.value : "STORY_IMAGE";
    const kind = z.nativeEnum(MediaKind).catch("STORY_IMAGE").parse(kindValue);
    const stored = await saveMultipartFile(file, kind).catch((error) => {
      if (error instanceof UnsupportedMediaTypeError) {
        throw reply.badRequest(error.message);
      }
      throw error;
    });
    const asset = await app.prisma.mediaAsset.create({
      data: {
        ownerId: request.user.sub,
        kind,
        provider: stored.provider,
        bucket: stored.bucket,
        url: stored.url,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        byteSize: stored.byteSize,
        width: stored.width,
        height: stored.height,
        variants: {
          create: stored.variants.map((variant) => ({
            kind: variant.kind,
            provider: variant.provider,
            bucket: variant.bucket,
            url: variant.url,
            storageKey: variant.storageKey,
            mimeType: variant.mimeType,
            byteSize: variant.byteSize,
            width: variant.width,
            height: variant.height
          }))
        }
      },
      include: { variants: true }
    });
    await moderateMediaAsset(app, asset.id);
    const moderatedAsset = await app.prisma.mediaAsset.findUniqueOrThrow({
      where: { id: asset.id },
      include: { variants: true }
    });

      return { statusCode: 201, body: moderatedAsset };
    });

    return reply.status(result.statusCode ?? 201).send(result.body);
  });
};
