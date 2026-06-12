/**
 * Regression tests for P1-3, P1-4, P1-5, and P2-10.
 *
 * These tests exercise the units directly with mocks rather than requiring
 * live infrastructure, so they run in the normal `npm test` suite.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseEnv() {
  process.env.DATABASE_URL = "postgresql://x:x@localhost:5432/x?schema=public";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "dev-access-secret-at-least-24-chars";
  process.env.JWT_REFRESH_SECRET = "dev-refresh-secret-at-least-24-chars";
  process.env.PUBLIC_MEDIA_URL = "http://localhost:4000/media";
  process.env.NODE_ENV = "test";
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// P1-3: Feed event ballot-stuffing guard
// ---------------------------------------------------------------------------
describe("P1-3: feed event score gate", () => {
  it("only allows passive telemetry events to influence scores", async () => {
    baseEnv();
    vi.resetModules();
    const { SCORE_CONTRIBUTING_EVENT_TYPES } = await import("../src/routes/feedEvents.js");
    const { FeedEventType } = await import("@prisma/client");

    // Passive telemetry events are allowed
    expect(SCORE_CONTRIBUTING_EVENT_TYPES.has(FeedEventType.IMPRESSION)).toBe(true);
    expect(SCORE_CONTRIBUTING_EVENT_TYPES.has(FeedEventType.OPEN)).toBe(true);
    expect(SCORE_CONTRIBUTING_EVENT_TYPES.has(FeedEventType.READ_PROGRESS)).toBe(true);
    expect(SCORE_CONTRIBUTING_EVENT_TYPES.has(FeedEventType.DWELL_TIME)).toBe(true);

    // Action events that can be forged are excluded
    expect(SCORE_CONTRIBUTING_EVENT_TYPES.has(FeedEventType.LIKE)).toBe(false);
    expect(SCORE_CONTRIBUTING_EVENT_TYPES.has(FeedEventType.SAVE)).toBe(false);
    expect(SCORE_CONTRIBUTING_EVENT_TYPES.has(FeedEventType.BOOKMARK)).toBe(false);
    expect(SCORE_CONTRIBUTING_EVENT_TYPES.has(FeedEventType.SHARE)).toBe(false);
    expect(SCORE_CONTRIBUTING_EVENT_TYPES.has(FeedEventType.COMMENT)).toBe(false);
    expect(SCORE_CONTRIBUTING_EVENT_TYPES.has(FeedEventType.HIDE)).toBe(false);
  });

  it("caps dwell time at 2 hours", async () => {
    baseEnv();
    vi.resetModules();
    const { MAX_DWELL_MS } = await import("../src/routes/feedEvents.js");
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    expect(MAX_DWELL_MS).toBe(TWO_HOURS_MS);
  });
});

// ---------------------------------------------------------------------------
// P1-5: Rate limit fail-closed
// ---------------------------------------------------------------------------
describe("P1-5: rate limit failClosed", () => {
  it("throws 503 when Redis is unavailable and failClosed is true", async () => {
    baseEnv();
    vi.resetModules();
    const { endpointRateLimit } = await import("../src/services/rateLimitService.js");

    const fakeRedis = { incr: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) };
    const fakeServer = { redis: fakeRedis };
    const fakeRequest = { user: { sub: "user-1" }, ip: "127.0.0.1", server: fakeServer };
    const fakeReply = {
      serviceUnavailable: vi.fn().mockImplementation((msg) => new Error(msg))
    };

    const handler = endpointRateLimit({ key: "test", limit: 10, windowSeconds: 60, failClosed: true });
    await expect(handler(fakeRequest as any, fakeReply as any)).rejects.toThrow("unavailable");
    expect(fakeReply.serviceUnavailable).toHaveBeenCalledTimes(1);
  });

  it("passes through when Redis is unavailable and failClosed is false (default)", async () => {
    baseEnv();
    vi.resetModules();
    const { endpointRateLimit } = await import("../src/services/rateLimitService.js");

    const fakeRedis = { incr: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) };
    const fakeServer = { redis: fakeRedis };
    const fakeRequest = { user: { sub: "user-1" }, ip: "127.0.0.1", server: fakeServer };
    const fakeReply = { serviceUnavailable: vi.fn() };

    const handler = endpointRateLimit({ key: "test", limit: 10, windowSeconds: 60 });
    await expect(handler(fakeRequest as any, fakeReply as any)).resolves.toBeUndefined();
    expect(fakeReply.serviceUnavailable).not.toHaveBeenCalled();
  });

  it("still enforces the limit when Redis is healthy", async () => {
    baseEnv();
    vi.resetModules();
    const { endpointRateLimit } = await import("../src/services/rateLimitService.js");

    const fakeRedis = {
      incr: vi.fn().mockResolvedValue(11), // over limit of 10
      expire: vi.fn().mockResolvedValue(1)
    };
    const fakeServer = { redis: fakeRedis };
    const fakeRequest = { user: { sub: "user-1" }, ip: "127.0.0.1", server: fakeServer };
    const thrown = new Error("rate limit exceeded");
    const fakeReply = { tooManyRequests: vi.fn().mockReturnValue(thrown) };

    const handler = endpointRateLimit({ key: "test", limit: 10, windowSeconds: 60, failClosed: true });
    await expect(handler(fakeRequest as any, fakeReply as any)).rejects.toThrow("rate limit exceeded");
  });
});

// ---------------------------------------------------------------------------
// P2-10: Idempotency race + handler failure
// ---------------------------------------------------------------------------
describe("P2-10: idempotency service", () => {
  it("returns conflict when a concurrent request created the key (P2002)", async () => {
    baseEnv();
    vi.resetModules();
    const { Prisma } = await import("@prisma/client");
    const { withIdempotency } = await import("../src/services/idempotencyService.js");

    const conflictError = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "test"
    });

    const fakePrisma = {
      idempotencyKey: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(conflictError),
        delete: vi.fn().mockResolvedValue({})
      }
    };
    const fakeServer = { prisma: fakePrisma };
    const fakeRequest = {
      headers: { "idempotency-key": "test-key-abc" },
      user: { sub: "user-1" },
      method: "POST",
      url: "/test",
      routeOptions: { url: "/test" },
      body: {},
      server: fakeServer
    };
    const conflict = new Error("conflict");
    const fakeReply = {
      unauthorized: vi.fn(),
      badRequest: vi.fn(),
      conflict: vi.fn().mockReturnValue(conflict)
    };

    await expect(withIdempotency(fakeRequest as any, fakeReply as any, async () => ({ body: {} }))).rejects.toThrow("conflict");
    expect(fakeReply.conflict).toHaveBeenCalledTimes(1);
  });

  it("deletes the idempotency key when the handler throws so retries can proceed", async () => {
    baseEnv();
    vi.resetModules();
    const { withIdempotency } = await import("../src/services/idempotencyService.js");

    const fakePrisma = {
      idempotencyKey: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({})
      }
    };
    const fakeServer = { prisma: fakePrisma };
    const fakeRequest = {
      headers: { "idempotency-key": "test-key-xyz" },
      user: { sub: "user-1" },
      method: "POST",
      url: "/test",
      routeOptions: { url: "/test" },
      body: {},
      server: fakeServer
    };
    const fakeReply = { unauthorized: vi.fn(), badRequest: vi.fn(), conflict: vi.fn() };

    const handlerError = new Error("handler failed");
    await expect(
      withIdempotency(fakeRequest as any, fakeReply as any, async () => { throw handlerError; })
    ).rejects.toThrow("handler failed");

    // The key must have been deleted so future retries aren't stuck
    expect(fakePrisma.idempotencyKey.delete).toHaveBeenCalledTimes(1);
    expect(fakePrisma.idempotencyKey.update).not.toHaveBeenCalled();
  });
});
