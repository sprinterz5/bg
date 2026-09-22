import { describe, expect, it } from "vitest";

function setTestEnv() {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://puzzle:puzzle@localhost:5432/puzzle?schema=public";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "dev-access-secret-at-least-24-chars";
  process.env.JWT_REFRESH_SECRET = "dev-refresh-secret-at-least-24-chars";
  process.env.MEDIA_STORAGE_DIR = "storage/uploads";
  process.env.PUBLIC_MEDIA_URL = "http://localhost:4000/media";
}

describe("Puzzle app", () => {
  it("registers plugins and routes", async () => {
    setTestEnv();
    const { buildApp } = await import("../src/app.js");
    const app = await buildApp();

    await app.ready();
    expect(app.hasRoute({ method: "GET", url: "/health" })).toBe(true);
    expect(app.hasRoute({ method: "POST", url: "/auth/login" })).toBe(true);
    expect(app.hasRoute({ method: "GET", url: "/feed" })).toBe(true);

    await app.close();
  });
});
