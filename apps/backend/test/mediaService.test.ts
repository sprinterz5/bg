import { Readable } from "node:stream";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

function setMediaEnv() {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://puzzle:puzzle@localhost:5432/puzzle?schema=public";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "dev-access-secret-at-least-24-chars";
  process.env.JWT_REFRESH_SECRET = "dev-refresh-secret-at-least-24-chars";
  process.env.MEDIA_STORAGE_PROVIDER = "LOCAL";
  process.env.MEDIA_STORAGE_DIR = "storage/uploads-test";
  process.env.MEDIA_BUCKET = "";
  process.env.PUBLIC_MEDIA_URL = "http://localhost:4000/media";
}

describe("mediaService", () => {
  it("sniffs, sanitizes, and creates thumbnail variant for images", async () => {
    setMediaEnv();
    const { saveMultipartFile } = await import("../src/services/mediaService.js");
    const png = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: "#b83280"
      }
    })
      .png()
      .toBuffer();

    const stored = await saveMultipartFile(
      {
        file: Readable.from(png),
        filename: "cover.png",
        mimetype: "application/octet-stream",
        fields: {}
      } as any,
      "ARTICLE_COVER"
    );

    expect(stored.mimeType).toBe("image/webp");
    expect(stored.width).toBe(800);
    expect(stored.height).toBe(600);
    expect(stored.storageKey).toContain("article_cover/");
    expect(stored.variants).toHaveLength(1);
    expect(stored.variants[0]?.kind).toBe("THUMBNAIL");
    expect(stored.variants[0]?.mimeType).toBe("image/webp");
    expect(stored.variants[0]?.width).toBeLessThanOrEqual(480);
  });
});
