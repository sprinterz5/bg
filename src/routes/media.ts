import { MediaKind } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { saveMultipartFile } from "../services/mediaService.js";

export const mediaRoutes: FastifyPluginAsync = async (app) => {
  app.post("/media", { preHandler: [app.authenticate] }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      throw reply.badRequest("File is required");
    }

    const kindValue = typeof file.fields.kind === "object" && "value" in file.fields.kind ? file.fields.kind.value : "STORY_IMAGE";
    const kind = z.nativeEnum(MediaKind).catch("STORY_IMAGE").parse(kindValue);
    const stored = await saveMultipartFile(file, kind);
    const asset = await app.prisma.mediaAsset.create({
      data: {
        ownerId: request.user.sub,
        kind,
        url: stored.url,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        byteSize: stored.byteSize
      }
    });

    return reply.status(201).send(asset);
  });
};
