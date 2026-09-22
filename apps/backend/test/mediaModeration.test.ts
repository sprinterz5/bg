import { describe, expect, it, vi } from "vitest";

function setMediaEnv() {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://puzzle:puzzle@localhost:5432/puzzle?schema=public";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "dev-access-secret-at-least-24-chars";
  process.env.JWT_REFRESH_SECRET = "dev-refresh-secret-at-least-24-chars";
  process.env.MEDIA_STORAGE_PROVIDER = "LOCAL";
  process.env.PUBLIC_MEDIA_URL = "http://localhost:4000/media";
}

type FakePrismaOptions = {
  asset?: { moderationStatus: string } | null;
  variant?: { mediaAsset: { moderationStatus: string } } | null;
};

function fakePrisma(opts: FakePrismaOptions) {
  return {
    mediaAsset: { findFirst: vi.fn().mockResolvedValue(opts.asset ?? null) },
    mediaVariant: { findFirst: vi.fn().mockResolvedValue(opts.variant ?? null) }
  } as any;
}

describe("isMediaKeyApproved (P0-2 media delivery gate)", () => {
  const key = "story_image/2026-06-12/asset.webp";

  it("serves an APPROVED asset", async () => {
    setMediaEnv();
    const { isMediaKeyApproved } = await import("../src/services/mediaService.js");
    const prisma = fakePrisma({ asset: { moderationStatus: "APPROVED" } });
    expect(await isMediaKeyApproved(prisma, key)).toBe(true);
  });

  it("blocks a PENDING asset", async () => {
    setMediaEnv();
    const { isMediaKeyApproved } = await import("../src/services/mediaService.js");
    const prisma = fakePrisma({ asset: { moderationStatus: "PENDING" } });
    expect(await isMediaKeyApproved(prisma, key)).toBe(false);
  });

  it("blocks a REJECTED asset", async () => {
    setMediaEnv();
    const { isMediaKeyApproved } = await import("../src/services/mediaService.js");
    const prisma = fakePrisma({ asset: { moderationStatus: "REJECTED" } });
    expect(await isMediaKeyApproved(prisma, key)).toBe(false);
  });

  it("falls back to the variant's owning asset status", async () => {
    setMediaEnv();
    const { isMediaKeyApproved } = await import("../src/services/mediaService.js");
    const thumbKey = "story_image/2026-06-12/asset_thumb.webp";

    const approved = fakePrisma({ asset: null, variant: { mediaAsset: { moderationStatus: "APPROVED" } } });
    expect(await isMediaKeyApproved(approved, thumbKey)).toBe(true);

    const pending = fakePrisma({ asset: null, variant: { mediaAsset: { moderationStatus: "PENDING" } } });
    expect(await isMediaKeyApproved(pending, thumbKey)).toBe(false);
  });

  it("blocks untracked keys (no matching asset or variant)", async () => {
    setMediaEnv();
    const { isMediaKeyApproved } = await import("../src/services/mediaService.js");
    const prisma = fakePrisma({ asset: null, variant: null });
    expect(await isMediaKeyApproved(prisma, "unknown/key.webp")).toBe(false);
  });

  it("blocks path-traversal keys without touching the database", async () => {
    setMediaEnv();
    const { isMediaKeyApproved } = await import("../src/services/mediaService.js");
    const prisma = fakePrisma({ asset: { moderationStatus: "APPROVED" } });
    expect(await isMediaKeyApproved(prisma, "../../etc/passwd")).toBe(false);
    expect(prisma.mediaAsset.findFirst).not.toHaveBeenCalled();
    expect(prisma.mediaVariant.findFirst).not.toHaveBeenCalled();
  });
});
