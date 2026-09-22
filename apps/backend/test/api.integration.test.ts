import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function setIntegrationEnv() {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://puzzle:puzzle@localhost:5432/puzzle?schema=public";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "dev-access-secret-at-least-24-chars";
  process.env.JWT_REFRESH_SECRET = "dev-refresh-secret-at-least-24-chars";
  process.env.MEDIA_STORAGE_DIR = "storage/uploads";
  process.env.MEDIA_STORAGE_PROVIDER = "LOCAL";
  process.env.PUBLIC_MEDIA_URL = "http://localhost:4000/media";
  process.env.AI_ENABLED = "true";
  process.env.AI_PROVIDER = "LOCAL_HASH";
  process.env.AI_EMBEDDING_MODEL = "bookgram-test-local-hash-v1";
  process.env.AI_EMBEDDING_DIMENSIONS = "32";
}

async function json(app: FastifyInstance, input: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  token?: string;
  headers?: Record<string, string>;
  body?: unknown;
}) {
  const response = await app.inject({
    method: input.method,
    url: input.url,
    headers: {
      ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
      ...(input.headers ?? {})
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

    const availableUsername = await json(app, {
      method: "GET",
      url: `/auth/username-availability?username=${encodeURIComponent(aliceUsername.toUpperCase())}`
    });
    expect(availableUsername.response.statusCode).toBe(200);
    expect(availableUsername.payload.available).toBe(true);
    expect(availableUsername.payload.normalizedUsername).toBe(aliceUsername);

    const reservedUsername = await json(app, {
      method: "GET",
      url: "/auth/username-availability?username=admin"
    });
    expect(reservedUsername.response.statusCode).toBe(200);
    expect(reservedUsername.payload.available).toBe(false);
    expect(reservedUsername.payload.reason).toBe("reserved");
    expect(reservedUsername.payload.suggestions.length).toBeGreaterThan(0);

    const aliceRegister = await json(app, {
      method: "POST",
      url: "/auth/register",
      body: {
        email: `${aliceUsername}@puzzle.dev`,
        username: aliceUsername.toUpperCase(),
        displayName: "Integration Alice",
        password: "Puzzle123!",
        interests: ["science fiction", "ideas", "culture"]
      }
    });
    expect(aliceRegister.response.statusCode).toBe(201);
    expect(aliceRegister.payload.user.username).toBe(aliceUsername);
    const aliceId = aliceRegister.payload.user.id as string;
    const aliceToken = aliceRegister.payload.accessToken as string;
    const aliceRefreshToken = aliceRegister.payload.refreshToken as string;
    expect(aliceRegister.payload.user.emailVerified).toBe(false);
    expect(aliceRegister.payload.devEmailVerificationToken).toBeTruthy();

    const takenUsername = await json(app, {
      method: "GET",
      url: `/auth/username-availability?username=${encodeURIComponent(aliceUsername)}`
    });
    expect(takenUsername.response.statusCode).toBe(200);
    expect(takenUsername.payload.available).toBe(false);
    expect(takenUsername.payload.reason).toBe("taken");
    expect(takenUsername.payload.suggestions.length).toBeGreaterThan(0);

    const emailVerified = await json(app, {
      method: "POST",
      url: "/auth/email/verify",
      body: {
        token: aliceRegister.payload.devEmailVerificationToken
      }
    });
    expect(emailVerified.response.statusCode).toBe(200);
    expect(emailVerified.payload.user.emailVerified).toBe(true);

    const initialSessions = await json(app, {
      method: "GET",
      url: "/auth/sessions",
      token: aliceToken
    });
    expect(initialSessions.response.statusCode).toBe(200);
    expect(initialSessions.payload.data.length).toBeGreaterThanOrEqual(1);

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
    const bobToken = bobRegister.payload.accessToken as string;

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

    const bobFollowsAlice = await json(app, {
      method: "POST",
      url: `/users/${aliceId}/follow`,
      token: bobToken
    });
    expect(bobFollowsAlice.response.statusCode).toBe(200);

    const readingNow = await json(app, {
      method: "GET",
      url: "/reading-now/friends?limit=10",
      token: bobToken
    });
    expect(readingNow.response.statusCode).toBe(200);
    expect(readingNow.payload.data.some((item: any) => item.user.id === aliceId && item.book.id === book.id)).toBe(true);

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

    const feedEvent = await json(app, {
      method: "POST",
      url: "/feed/events",
      token: aliceToken,
      body: {
        eventType: "OPEN",
        targetType: "ARTICLE",
        targetId: article.payload.id,
        source: "integration_test",
        dwellMs: 1200,
        progress: 50
      }
    });
    expect(feedEvent.response.statusCode).toBe(201);
    expect(feedEvent.payload.count).toBe(1);

    const feedEventSummary = await json(app, {
      method: "GET",
      url: "/me/feed-events/summary",
      token: aliceToken
    });
    expect(feedEventSummary.response.statusCode).toBe(200);
    expect(feedEventSummary.payload.data.some((item: any) => item.eventType === "OPEN")).toBe(true);

    const comment = await json(app, {
      method: "POST",
      url: "/comments",
      token: bobToken,
      headers: { "Idempotency-Key": `comment-${suffix}` },
      body: {
        targetType: "ARTICLE",
        targetId: article.payload.id,
        body: "This is a useful integration-test comment."
      }
    });
    expect(comment.response.statusCode).toBe(201);
    expect(comment.payload.body).toContain("integration-test comment");

    const repeatedComment = await json(app, {
      method: "POST",
      url: "/comments",
      token: bobToken,
      headers: { "Idempotency-Key": `comment-${suffix}` },
      body: {
        targetType: "ARTICLE",
        targetId: article.payload.id,
        body: "This is a useful integration-test comment."
      }
    });
    expect(repeatedComment.response.statusCode).toBe(201);
    expect(repeatedComment.payload.id).toBe(comment.payload.id);

    const commentList = await json(app, {
      method: "GET",
      url: `/comments?targetType=ARTICLE&targetId=${article.payload.id}`,
      token: aliceToken
    });
    expect(commentList.response.statusCode).toBe(200);
    expect(commentList.payload.data.some((item: any) => item.id === comment.payload.id)).toBe(true);

    const bookmark = await json(app, {
      method: "POST",
      url: "/bookmarks/toggle",
      token: bobToken,
      body: {
        targetType: "ARTICLE",
        targetId: article.payload.id
      }
    });
    expect(bookmark.response.statusCode).toBe(200);
    expect(bookmark.payload.bookmarked).toBe(true);

    const countersAfterBookmark = await app.prisma.contentCounter.findUnique({
      where: {
        targetType_targetId: {
          targetType: "ARTICLE",
          targetId: article.payload.id
        }
      }
    });
    expect(countersAfterBookmark?.comments).toBeGreaterThanOrEqual(1);
    expect(countersAfterBookmark?.bookmarks).toBeGreaterThanOrEqual(1);

    const bookmarks = await json(app, {
      method: "GET",
      url: "/me/bookmarks?targetType=ARTICLE",
      token: bobToken
    });
    expect(bookmarks.response.statusCode).toBe(200);
    expect(bookmarks.payload.data.some((item: any) => item.targetId === article.payload.id)).toBe(true);

    const bobFeed = await json(app, {
      method: "GET",
      url: "/feed?mode=for_you&filter=articles&limit=50",
      token: bobToken
    });
    expect(bobFeed.response.statusCode).toBe(200);
    const bobArticleFeedItem = bobFeed.payload.data.find((item: any) => item.targetId === article.payload.id);
    expect(bobArticleFeedItem).toBeTruthy();
    expect("media" in bobArticleFeedItem).toBe(true);
    expect(bobArticleFeedItem.viewer.bookmarked).toBe(true);
    expect(bobArticleFeedItem.counts.comments).toBeGreaterThanOrEqual(1);

    const home = await json(app, {
      method: "GET",
      url: "/home?feedLimit=10&readingNowLimit=10",
      token: bobToken
    });
    expect(home.response.statusCode).toBe(200);
    expect(home.payload.readingNow.friends.some((item: any) => item.user.id === aliceId)).toBe(true);
    expect(home.payload.feed.data.length).toBeGreaterThanOrEqual(1);

    const similarBook = await app.prisma.book.create({
      data: {
        isbn13: `9780001${suffix.slice(-6).padStart(6, "0")}`,
        title: `Integration Similar Book ${suffix}`,
        authors: ["Puzzle Test"],
        description: "A generated similar book used by the integration suite.",
        categories: ["science fiction", "ideas"],
        source: "MANUAL"
      }
    });

    const similar = await json(app, {
      method: "POST",
      url: `/books/${book.id}/similar/recompute?limit=10`,
      token: aliceToken
    });
    expect(similar.response.statusCode).toBe(200);
    expect(similar.payload.data.some((item: any) => item.book.id === similarBook.id)).toBe(true);

    const deviceToken = `apns-${suffix}-${"x".repeat(32)}`;
    const registerDeviceToken = await json(app, {
      method: "POST",
      url: "/device-tokens",
      token: aliceToken,
      body: {
        token: deviceToken,
        platform: "IOS"
      }
    });
    expect(registerDeviceToken.response.statusCode).toBe(201);
    expect(registerDeviceToken.payload.token).toBe(deviceToken);

    const deleteDeviceToken = await json(app, {
      method: "DELETE",
      url: "/device-tokens",
      token: aliceToken,
      body: {
        token: deviceToken
      }
    });
    expect(deleteDeviceToken.response.statusCode).toBe(200);

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

    const sharedViaEndpoint = await json(app, {
      method: "POST",
      url: "/share",
      token: aliceToken,
      headers: { "Idempotency-Key": `share-${suffix}` },
      body: {
        targetType: "ARTICLE",
        targetId: article.payload.id,
        conversationId: conversation.payload.id,
        body: "Shared through /share.",
        source: "integration_test"
      }
    });
    expect(sharedViaEndpoint.response.statusCode).toBe(201);
    expect(sharedViaEndpoint.payload.shared).toBe(true);
    expect(sharedViaEndpoint.payload.message.type).toBe("SHARE_ARTICLE");

    const repeatedShare = await json(app, {
      method: "POST",
      url: "/share",
      token: aliceToken,
      headers: { "Idempotency-Key": `share-${suffix}` },
      body: {
        targetType: "ARTICLE",
        targetId: article.payload.id,
        conversationId: conversation.payload.id,
        body: "Shared through /share.",
        source: "integration_test"
      }
    });
    expect(repeatedShare.response.statusCode).toBe(201);
    expect(repeatedShare.payload.message.id).toBe(sharedViaEndpoint.payload.message.id);

    const localUploadContract = await json(app, {
      method: "POST",
      url: "/media/upload-url",
      token: aliceToken,
      body: {
        kind: "STORY_IMAGE",
        contentType: "image/jpeg",
        byteSize: 1024
      }
    });
    expect(localUploadContract.response.statusCode).toBe(501);
    expect(localUploadContract.payload.error).toBe("direct_upload_not_available");
    expect(localUploadContract.payload.fallback.url).toBe("/media");

    const report = await json(app, {
      method: "POST",
      url: "/reports",
      token: aliceToken,
      body: {
        targetType: "MESSAGE",
        targetId: message.payload.id,
        reason: "SPAM",
        details: "Integration report"
      }
    });
    expect(report.response.statusCode).toBe(201);

    const reportResolved = await json(app, {
      method: "PATCH",
      url: `/reports/${report.payload.id}`,
      token: moderatorToken,
      body: {
        status: "RESOLVED",
        resolution: "NO_VIOLATION",
        moderatorNote: "Integration resolution"
      }
    });
    expect(reportResolved.response.statusCode).toBe(200);
    expect(reportResolved.payload.status).toBe("RESOLVED");

    const spamScoreJob = await json(app, {
      method: "POST",
      url: "/moderation/jobs/spam-score",
      token: moderatorToken,
      body: {
        limit: 20,
        threshold: 70
      }
    });
    expect(spamScoreJob.response.statusCode).toBe(200);
    expect(spamScoreJob.payload.scanned).toBeGreaterThanOrEqual(1);
    expect(spamScoreJob.payload.data.some((item: any) => item.targetId === article.payload.id)).toBe(true);

    const maintenanceJob = await json(app, {
      method: "POST",
      url: "/moderation/jobs/maintenance",
      token: moderatorToken,
      body: {
        bookLimit: 5
      }
    });
    expect(maintenanceJob.response.statusCode).toBe(200);
    expect(typeof maintenanceJob.payload.expiredStories).toBe("number");
    expect(typeof maintenanceJob.payload.recomputedBooks).toBe("number");

    const adminJobRuns = await json(app, {
      method: "GET",
      url: "/admin/job-runs?limit=20",
      token: moderatorToken
    });
    expect(adminJobRuns.response.statusCode).toBe(200);
    expect(adminJobRuns.payload.data.some((item: any) => item.name === "spam-score" && item.status === "SUCCEEDED")).toBe(true);
    expect(adminJobRuns.payload.data.some((item: any) => item.name === "maintenance" && item.status === "SUCCEEDED")).toBe(true);

    const aiReadiness = await json(app, {
      method: "GET",
      url: "/ai/readiness",
      token: moderatorToken
    });
    expect(aiReadiness.response.statusCode).toBe(200);
    expect(aiReadiness.payload.ready).toBe(true);
    expect(aiReadiness.payload.provider).toBe("LOCAL_HASH");

    const aiEmbeddingJob = await json(app, {
      method: "POST",
      url: "/ai/jobs/embeddings",
      token: moderatorToken,
      body: {
        limit: 10,
        targetTypes: ["ARTICLE", "REVIEW", "BOOK"]
      }
    });
    expect(aiEmbeddingJob.response.statusCode).toBe(200);
    expect(aiEmbeddingJob.payload.generated).toBeGreaterThanOrEqual(1);

    const aiEmbeddings = await json(app, {
      method: "GET",
      url: "/ai/embeddings?status=READY&limit=20",
      token: moderatorToken
    });
    expect(aiEmbeddings.response.statusCode).toBe(200);
    expect(aiEmbeddings.payload.data.some((item: any) => item.targetId === article.payload.id && item.dimensions === 32)).toBe(true);

    const pendingMedia = await app.prisma.mediaAsset.create({
      data: {
        ownerId: aliceId,
        kind: "STORY_IMAGE",
        provider: "LOCAL",
        url: "http://localhost:4000/media/test.webp",
        storageKey: `integration/${suffix}.webp`,
        mimeType: "image/webp",
        byteSize: 1024,
        width: 320,
        height: 480
      }
    });

    const mediaModerationReadiness = await json(app, {
      method: "GET",
      url: "/media/moderation/readiness",
      token: moderatorToken
    });
    expect(mediaModerationReadiness.response.statusCode).toBe(200);
    expect(mediaModerationReadiness.payload.provider).toBe("DISABLED");

    const mediaModerationQueue = await json(app, {
      method: "GET",
      url: "/media/moderation/queue?status=PENDING&limit=20",
      token: moderatorToken
    });
    expect(mediaModerationQueue.response.statusCode).toBe(200);
    expect(mediaModerationQueue.payload.data.some((item: any) => item.id === pendingMedia.id)).toBe(true);

    const mediaModerationDecision = await json(app, {
      method: "PATCH",
      url: `/media/${pendingMedia.id}/moderation`,
      token: moderatorToken,
      body: {
        status: "APPROVED",
        reason: "Integration manual approval",
        score: 0.01
      }
    });
    expect(mediaModerationDecision.response.statusCode).toBe(200);
    expect(mediaModerationDecision.payload.moderationStatus).toBe("APPROVED");

    const mediaModerationJob = await json(app, {
      method: "POST",
      url: "/media/moderation/jobs/scan",
      token: moderatorToken,
      body: { limit: 10 }
    });
    expect(mediaModerationJob.response.statusCode).toBe(200);
    expect(typeof mediaModerationJob.payload.scanned).toBe("number");

    const adminStats = await json(app, {
      method: "GET",
      url: "/admin/stats",
      token: moderatorToken
    });
    expect(adminStats.response.statusCode).toBe(200);
    expect(adminStats.payload.users.total).toBeGreaterThanOrEqual(2);

    const adminDashboard = await app.inject({
      method: "GET",
      url: "/admin"
    });
    expect(adminDashboard.statusCode).toBe(200);
    expect(adminDashboard.headers["content-type"]).toContain("text/html");
    expect(adminDashboard.payload).toContain("Bookgram Admin");

    const adminContentScores = await json(app, {
      method: "GET",
      url: "/admin/content-scores?sort=spam&limit=100",
      token: moderatorToken
    });
    expect(adminContentScores.response.statusCode).toBe(200);
    expect(adminContentScores.payload.data.some((item: any) => item.targetId === article.payload.id)).toBe(true);

    const notifications = await json(app, {
      method: "GET",
      url: "/notifications",
      token: aliceToken
    });
    expect(notifications.response.statusCode).toBe(200);
    expect(notifications.payload.data.some((item: any) => item.type === "REPORT_RESOLVED")).toBe(true);

    const unreadCount = await json(app, {
      method: "GET",
      url: "/notifications/unread-count",
      token: aliceToken
    });
    expect(unreadCount.response.statusCode).toBe(200);
    expect(unreadCount.payload.count).toBeGreaterThanOrEqual(1);

    const search = await json(app, {
      method: "GET",
      url: `/search?q=${encodeURIComponent(suffix)}&type=all&limit=10`,
      token: aliceToken
    });
    expect(search.response.statusCode).toBe(200);
    expect(search.payload.data.articles.some((item: any) => item.id === article.payload.id)).toBe(true);

    const forgotPassword = await json(app, {
      method: "POST",
      url: "/auth/password/forgot",
      body: {
        email: `${aliceUsername}@puzzle.dev`
      }
    });
    expect(forgotPassword.response.statusCode).toBe(202);
    expect(forgotPassword.payload.devPasswordResetToken).toBeTruthy();

    const resetPassword = await json(app, {
      method: "POST",
      url: "/auth/password/reset",
      body: {
        token: forgotPassword.payload.devPasswordResetToken,
        password: "NewPuzzle123!"
      }
    });
    expect(resetPassword.response.statusCode).toBe(200);

    const loginWithNewPassword = await json(app, {
      method: "POST",
      url: "/auth/login",
      body: {
        login: `${aliceUsername}@puzzle.dev`,
        password: "NewPuzzle123!"
      }
    });
    expect(loginWithNewPassword.response.statusCode).toBe(200);

    const muteBob = await json(app, {
      method: "POST",
      url: `/users/${bobId}/mute`,
      token: aliceToken
    });
    expect(muteBob.response.statusCode).toBe(201);

    const mutes = await json(app, {
      method: "GET",
      url: "/me/mutes",
      token: aliceToken
    });
    expect(mutes.response.statusCode).toBe(200);
    expect(mutes.payload.data.some((item: any) => item.mutedId === bobId)).toBe(true);

    const blockBob = await json(app, {
      method: "POST",
      url: `/users/${bobId}/block`,
      token: aliceToken
    });
    expect(blockBob.response.statusCode).toBe(201);

    const blocks = await json(app, {
      method: "GET",
      url: "/me/blocks",
      token: aliceToken
    });
    expect(blocks.response.statusCode).toBe(200);
    expect(blocks.payload.data.some((item: any) => item.blockedId === bobId)).toBe(true);

    const blockedConversation = await json(app, {
      method: "POST",
      url: "/conversations/direct",
      token: aliceToken,
      body: { userId: bobId }
    });
    expect(blockedConversation.response.statusCode).toBe(403);

    const logoutAll = await json(app, {
      method: "POST",
      url: "/auth/logout-all",
      token: aliceToken,
      body: {
        keepRefreshToken: aliceRefreshToken
      }
    });
    expect(logoutAll.response.statusCode).toBe(200);
  });
});
