import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function setIntegrationEnv() {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://puzzle:puzzle@localhost:5432/puzzle?schema=public";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "dev-access-secret-at-least-24-chars";
  process.env.JWT_REFRESH_SECRET = "dev-refresh-secret-at-least-24-chars";
  process.env.MEDIA_STORAGE_DIR = "storage/uploads";
  process.env.PUBLIC_MEDIA_URL = "http://localhost:4000/media";
}

async function json(app: FastifyInstance, input: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  token?: string;
  body?: unknown;
}) {
  const response = await app.inject({
    method: input.method,
    url: input.url,
    headers: {
      ...(input.token ? { authorization: `Bearer ${input.token}` } : {})
    },
    payload: input.body
  });

  const payload = response.payload ? JSON.parse(response.payload) : null;
  return { response, payload };
}

describe("Puzzle API integration", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    setIntegrationEnv();
    const { buildApp } = await import("../src/app.js");
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("runs the core MVP content loop on live Postgres and Redis", async () => {
    const suffix = Date.now().toString(36);
    const aliceUsername = `it_alice_${suffix}`;
    const bobUsername = `it_bob_${suffix}`;

    const aliceRegister = await json(app, {
      method: "POST",
      url: "/auth/register",
      body: {
        email: `${aliceUsername}@puzzle.dev`,
        username: aliceUsername,
        displayName: "Integration Alice",
        password: "Puzzle123!",
        interests: ["science fiction", "ideas", "culture"]
      }
    });
    expect(aliceRegister.response.statusCode).toBe(201);
    const aliceToken = aliceRegister.payload.accessToken as string;

    const bobRegister = await json(app, {
      method: "POST",
      url: "/auth/register",
      body: {
        email: `${bobUsername}@puzzle.dev`,
        username: bobUsername,
        displayName: "Integration Bob",
        password: "Puzzle123!",
        interests: ["psychology"]
      }
    });
    expect(bobRegister.response.statusCode).toBe(201);
    const bobId = bobRegister.payload.user.id as string;

    const book = await app.prisma.book.upsert({
      where: { isbn13: `9790000${suffix.slice(-6).padStart(6, "0")}` },
      update: {},
      create: {
        isbn13: `9790000${suffix.slice(-6).padStart(6, "0")}`,
        title: `Integration Book ${suffix}`,
        authors: ["Puzzle Test"],
        description: "A generated book used by the integration suite.",
        thumbnailUrl: "https://example.com/book.jpg",
        categories: ["science fiction", "ideas"],
        source: "MANUAL"
      }
    });

    const shelf = await json(app, {
      method: "PUT",
      url: `/me/shelves/${book.id}`,
      token: aliceToken,
      body: {
        status: "READING",
        progressPercent: 25
      }
    });
    expect(shelf.response.statusCode).toBe(200);
    expect(shelf.payload.status).toBe("READING");

    const article = await json(app, {
      method: "POST",
      url: "/articles",
      token: aliceToken,
      body: {
        title: `Integration Article ${suffix}`,
        body: "Books become social when readers leave traces for each other. This article exists to test the publishing and moderation path.",
        tags: ["ideas", "culture"]
      }
    });
    expect(article.response.statusCode).toBe(201);

    const publishedArticle = await json(app, {
      method: "POST",
      url: `/articles/${article.payload.id}/publish`,
      token: aliceToken
    });
    expect(publishedArticle.response.statusCode).toBe(200);
    expect(publishedArticle.payload.moderationStatus).toBe("PENDING");

    const moderator = await app.prisma.user.upsert({
      where: { email: `it_mod_${suffix}@puzzle.dev` },
      update: { role: "MODERATOR" },
      create: {
        email: `it_mod_${suffix}@puzzle.dev`,
        username: `it_mod_${suffix}`,
        role: "MODERATOR",
        interests: ["moderation"]
      }
    });
    const moderatorToken = app.jwt.sign({
      sub: moderator.id,
      username: moderator.username,
      role: moderator.role
    });

    const approved = await json(app, {
      method: "POST",
      url: `/moderation/ARTICLE/${article.payload.id}/approve`,
      token: moderatorToken,
      body: {
        reason: "Integration test approval",
        score: 99
      }
    });
    expect(approved.response.statusCode).toBe(200);
    expect(approved.payload.moderationStatus).toBe("APPROVED");

    const note = await json(app, {
      method: "POST",
      url: "/notes",
      token: aliceToken,
      body: {
        targetType: "ARTICLE",
        targetId: article.payload.id,
        selectedText: "readers leave traces",
        noteText: "This is the Notes loop.",
        anchorStart: 25,
        anchorEnd: 46
      }
    });
    expect(note.response.statusCode).toBe(201);

    const feed = await json(app, {
      method: "GET",
      url: "/feed?mode=for_you&filter=articles&limit=10",
      token: aliceToken
    });
    expect(feed.response.statusCode).toBe(200);
    expect(feed.payload.data.some((item: any) => item.targetId === article.payload.id)).toBe(true);

    const explore = await json(app, {
      method: "GET",
      url: "/explore?filter=articles&limit=10",
      token: aliceToken
    });
    expect(explore.response.statusCode).toBe(200);
    expect(explore.payload.data.some((item: any) => item.content.id === article.payload.id)).toBe(true);

    const conversation = await json(app, {
      method: "POST",
      url: "/conversations/direct",
      token: aliceToken,
      body: { userId: bobId }
    });
    expect(conversation.response.statusCode).toBe(201);

    const message = await json(app, {
      method: "POST",
      url: `/conversations/${conversation.payload.id}/messages`,
      token: aliceToken,
      body: {
        type: "SHARE_ARTICLE",
        body: "Read this.",
        sharedArticleId: article.payload.id
      }
    });
    expect(message.response.statusCode).toBe(201);
    expect(message.payload.type).toBe("SHARE_ARTICLE");
  });
});
