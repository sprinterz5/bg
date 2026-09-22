import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const RESET_TEXT = "Reset your Bookgram password: https://app.example.com/reset?token=SUPERSECRETTOKEN";

function baseEnv() {
  process.env.DATABASE_URL = "postgresql://puzzle:puzzle@localhost:5432/puzzle?schema=public";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "dev-access-secret-at-least-24-chars";
  process.env.JWT_REFRESH_SECRET = "dev-refresh-secret-at-least-24-chars";
  process.env.PUBLIC_MEDIA_URL = "http://localhost:4000/media";
}

function fakeApp() {
  return { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as any;
}

function loggedString(app: any) {
  return JSON.stringify([
    ...app.log.info.mock.calls,
    ...app.log.warn.mock.calls,
    ...app.log.error.mock.calls
  ]);
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("sendMail (P0-1 transport + token-leak protection)", () => {
  it("never logs the token in production when no transport is configured", async () => {
    baseEnv();
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "LOG";
    vi.resetModules();

    const { sendMail } = await import("../src/services/emailService.js");
    const app = fakeApp();
    await sendMail(app, { to: "user@example.com", subject: "Reset your password", text: RESET_TEXT });

    expect(app.log.error).toHaveBeenCalledTimes(1);
    expect(app.log.info).not.toHaveBeenCalled();
    expect(loggedString(app)).not.toContain("SUPERSECRETTOKEN");
  });

  it("delivers via Resend and never logs the token", async () => {
    baseEnv();
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "RESEND";
    process.env.RESEND_API_KEY = "re_test_key";
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    const { sendMail } = await import("../src/services/emailService.js");
    const app = fakeApp();
    await sendMail(app, { to: "user@example.com", subject: "Reset your password", text: RESET_TEXT });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/emails");
    expect(options.headers.authorization).toContain("re_test_key");
    // The token is delivered in the request body...
    expect(options.body).toContain("SUPERSECRETTOKEN");
    // ...but is never written to the logs.
    expect(loggedString(app)).not.toContain("SUPERSECRETTOKEN");
    expect(app.log.info).toHaveBeenCalledTimes(1);
  });

  it("does not throw (breaking the auth flow) when Resend delivery fails", async () => {
    baseEnv();
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "RESEND";
    process.env.RESEND_API_KEY = "re_test_key";
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => "bad request" });
    vi.stubGlobal("fetch", fetchMock);

    const { sendMail } = await import("../src/services/emailService.js");
    const app = fakeApp();
    await expect(
      sendMail(app, { to: "user@example.com", subject: "Reset your password", text: RESET_TEXT })
    ).resolves.toBeUndefined();
    expect(app.log.error).toHaveBeenCalledTimes(1);
    expect(loggedString(app)).not.toContain("SUPERSECRETTOKEN");
  });

  it("keeps the dev transport (logs body) outside production", async () => {
    baseEnv();
    process.env.NODE_ENV = "development";
    process.env.EMAIL_PROVIDER = "LOG";
    vi.resetModules();

    const { sendMail } = await import("../src/services/emailService.js");
    const app = fakeApp();
    await sendMail(app, { to: "user@example.com", subject: "Reset your password", text: RESET_TEXT });

    expect(app.log.info).toHaveBeenCalledTimes(1);
    expect(loggedString(app)).toContain("SUPERSECRETTOKEN");
  });
});
