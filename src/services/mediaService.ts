import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { MultipartFile } from "@fastify/multipart";
import type { PrismaClient } from "@prisma/client";
import { fileTypeFromBuffer } from "file-type";
import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "../config/env.js";

const allowedImageMimes = new Set(["image/jpeg", "image/png", "image/webp"]);

// Hard pixel-count cap before any Sharp decode. A 10 MB decompression-bomb
// image can still expand to hundreds of megapixels in memory; this prevents
// that without relying on compressed-size alone.
const MAX_INPUT_PIXELS = 50_000_000; // 50 MP ≈ 7071×7071

export class UnsupportedMediaTypeError extends Error {
  constructor(message = "Unsupported media type") {
    super(message);
    this.name = "UnsupportedMediaTypeError";
  }
}

const maxImageDimensionByKind: Record<string, number> = {
  AVATAR: 1024,
  ARTICLE_COVER: 2200,
  STORY_IMAGE: 2200,
  CHAT_ATTACHMENT: 2200,
  BOOK_COVER_CACHE: 1600
};

const thumbnailSizeByKind: Record<string, number> = {
  AVATAR: 256,
  ARTICLE_COVER: 480,
  STORY_IMAGE: 480,
  CHAT_ATTACHMENT: 360,
  BOOK_COVER_CACHE: 320
};

async function streamToBuffer(file: MultipartFile) {
  const chunks: Buffer[] = [];
  for await (const chunk of file.file) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function normalizeStorageKey(storageKey: string) {
  return storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function mediaPublicBaseUrl() {
  return (env.MEDIA_PUBLIC_BASE_URL || env.PUBLIC_MEDIA_URL).replace(/\/+$/, "");
}

export function publicMediaUrl(storageKey: string) {
  return `${mediaPublicBaseUrl()}/${normalizeStorageKey(storageKey)}`;
}

/**
 * Determines whether a stored object may be served publicly. Only assets (and
 * their variants) whose owning asset has passed moderation are servable;
 * anything PENDING/REJECTED/FLAGGED or untracked is treated as not found. This
 * is the delivery-time gate that makes media moderation actually enforced.
 */
export async function isMediaKeyApproved(prisma: PrismaClient, storageKey: string): Promise<boolean> {
  const normalizedKey = normalizeStorageKey(storageKey);
  if (!normalizedKey || normalizedKey.includes("..")) {
    return false;
  }

  const asset = await prisma.mediaAsset.findFirst({
    where: { storageKey: normalizedKey },
    select: { moderationStatus: true }
  });
  if (asset) {
    return asset.moderationStatus === "APPROVED";
  }

  const variant = await prisma.mediaVariant.findFirst({
    where: { storageKey: normalizedKey },
    select: { mediaAsset: { select: { moderationStatus: true } } }
  });
  if (variant) {
    return variant.mediaAsset.moderationStatus === "APPROVED";
  }

  return false;
}

async function writeLocalObject(storageKey: string, buffer: Buffer) {
  const absolutePath = path.resolve(env.MEDIA_STORAGE_DIR, storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  const fileStat = await stat(absolutePath);
  return {
    storageKey: normalizeStorageKey(storageKey),
    url: publicMediaUrl(storageKey),
    byteSize: fileStat.size
  };
}

let s3Client: S3Client | null = null;

function getS3Client() {
  if (!s3Client) {
    if (!env.MEDIA_BUCKET || !env.MEDIA_ACCESS_KEY_ID || !env.MEDIA_SECRET_ACCESS_KEY) {
      throw new Error("MEDIA_BUCKET, MEDIA_ACCESS_KEY_ID, and MEDIA_SECRET_ACCESS_KEY are required for R2/S3 storage");
    }

    s3Client = new S3Client({
      region: env.MEDIA_REGION || "auto",
      endpoint: env.MEDIA_ENDPOINT || undefined,
      forcePathStyle: env.MEDIA_STORAGE_PROVIDER === "R2",
      credentials: {
        accessKeyId: env.MEDIA_ACCESS_KEY_ID,
        secretAccessKey: env.MEDIA_SECRET_ACCESS_KEY
      }
    });
  }

  return s3Client;
}

async function writeRemoteObject(storageKey: string, buffer: Buffer, mimeType: string) {
  const normalizedKey = normalizeStorageKey(storageKey);
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: env.MEDIA_BUCKET,
      Key: normalizedKey,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable"
    })
  );

  return {
    storageKey: normalizedKey,
    url: publicMediaUrl(normalizedKey),
    byteSize: buffer.byteLength
  };
}

export async function readRemoteMediaObject(storageKey: string) {
  const normalizedKey = normalizeStorageKey(storageKey);
  if (!normalizedKey || normalizedKey.includes("..")) {
    throw new UnsupportedMediaTypeError("Invalid media key");
  }

  const object = await getS3Client().send(
    new GetObjectCommand({
      Bucket: env.MEDIA_BUCKET,
      Key: normalizedKey
    })
  );
  if (!object.Body) {
    throw new Error("Remote media object has no body");
  }

  return {
    body: object.Body,
    contentType: object.ContentType ?? "application/octet-stream",
    contentLength: object.ContentLength,
    cacheControl: object.CacheControl ?? "public, max-age=31536000, immutable"
  };
}

async function writeObject(storageKey: string, buffer: Buffer, mimeType: string) {
  if (env.MEDIA_STORAGE_PROVIDER === "LOCAL") {
    return writeLocalObject(storageKey, buffer);
  }

  return writeRemoteObject(storageKey, buffer, mimeType);
}

export interface StoredMedia {
  provider: "LOCAL" | "R2" | "S3";
  bucket?: string;
  storageKey: string;
  url: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  variants: Array<{
    kind: "THUMBNAIL";
    provider: "LOCAL" | "R2" | "S3";
    bucket?: string;
    storageKey: string;
    url: string;
    mimeType: string;
    byteSize: number;
    width?: number;
    height?: number;
  }>;
}

export async function saveMultipartFile(file: MultipartFile, kind: string): Promise<StoredMedia> {
  const inputBuffer = await streamToBuffer(file);
  const detected = await fileTypeFromBuffer(inputBuffer);
  if (!detected || !allowedImageMimes.has(detected.mime)) {
    throw new UnsupportedMediaTypeError("Unsupported media type. Only JPEG, PNG, and WebP images are allowed.");
  }

  const safeKind = kind.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  const objectId = randomUUID();
  const maxDimension = maxImageDimensionByKind[kind] ?? 2200;
  const thumbnailSize = thumbnailSizeByKind[kind] ?? 480;

  const sharpOpts = { failOn: "warning" as const, limitInputPixels: MAX_INPUT_PIXELS };

  // Read dimensions first so we can reject oversized images before a full
  // decode. limitInputPixels in sharpOpts also guards inside Sharp itself.
  const image = sharp(inputBuffer, sharpOpts).rotate();
  const metadata = await image.metadata();
  const originalWidth = metadata.width ?? undefined;
  const originalHeight = metadata.height ?? undefined;

  if (originalWidth && originalHeight && originalWidth * originalHeight > MAX_INPUT_PIXELS) {
    throw new UnsupportedMediaTypeError(
      `Image dimensions (${originalWidth}×${originalHeight}) exceed the maximum allowed size.`
    );
  }

  const mainBuffer = await sharp(inputBuffer, sharpOpts)
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: 86, effort: 4 })
    .toBuffer();

  const mainMetadata = await sharp(mainBuffer).metadata();
  const mainStorageKey = path.join(safeKind, date, `${objectId}.webp`);
  const main = await writeObject(mainStorageKey, mainBuffer, "image/webp");

  const thumbnailBuffer = await sharp(inputBuffer, sharpOpts)
    .rotate()
    .resize({
      width: thumbnailSize,
      height: thumbnailSize,
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();

  const thumbnailMetadata = await sharp(thumbnailBuffer).metadata();
  const thumbnailStorageKey = path.join(safeKind, date, `${objectId}_thumb.webp`);
  const thumbnail = await writeObject(thumbnailStorageKey, thumbnailBuffer, "image/webp");

  return {
    provider: env.MEDIA_STORAGE_PROVIDER,
    bucket: env.MEDIA_BUCKET || undefined,
    storageKey: main.storageKey,
    url: main.url,
    mimeType: "image/webp",
    byteSize: main.byteSize,
    width: mainMetadata.width ?? originalWidth,
    height: mainMetadata.height ?? originalHeight,
    variants: [
      {
        kind: "THUMBNAIL",
        provider: env.MEDIA_STORAGE_PROVIDER,
        bucket: env.MEDIA_BUCKET || undefined,
        storageKey: thumbnail.storageKey,
        url: thumbnail.url,
        mimeType: "image/webp",
        byteSize: thumbnail.byteSize,
        width: thumbnailMetadata.width,
        height: thumbnailMetadata.height
      }
    ]
  };
}
