import type { MultipartFile } from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { env } from "../config/env.js";

const extensionByMime: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic"
};

export async function saveMultipartFile(file: MultipartFile, kind: string) {
  const extension = extensionByMime[file.mimetype] ?? path.extname(file.filename) ?? "";
  const safeKind = kind.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  const storageKey = path.join(safeKind, date, `${randomUUID()}${extension}`);
  const absolutePath = path.resolve(env.MEDIA_STORAGE_DIR, storageKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await pipeline(file.file, createWriteStream(absolutePath));
  const fileStat = await stat(absolutePath);
  const publicKey = storageKey.replace(/\\/g, "/");

  return {
    storageKey: publicKey,
    url: `${env.PUBLIC_MEDIA_URL}/${publicKey}`,
    mimeType: file.mimetype,
    byteSize: fileStat.size
  };
}
