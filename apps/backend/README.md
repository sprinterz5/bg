# Bookgram Backend

Backend for Bookgram: a social network around books, articles, reviews, reading shelves, stories, notes, chats, and moderated Explore.

## Stack

- Node.js + TypeScript
- Fastify REST API
- Socket.io realtime
- PostgreSQL + Prisma
- Redis for feed cache and realtime degradation path
- Google Books API with Open Library fallback
- Local, Cloudflare R2, or S3-compatible media storage
- AI embedding pipeline prepared but disabled by default

## Local Runtime

A portable Node.js runtime was downloaded into `.tools/node` because the system Node/npm were unavailable in this workspace.

Use:

```powershell
.\.tools\node\npm.cmd run dev
```

If you install Node.js normally later, regular `npm run dev` will work too.

## Setup

```powershell
Copy-Item .env.example .env
docker compose up -d
.\.tools\node\npm.cmd run prisma:migrate
.\.tools\node\npm.cmd run db:seed
.\.tools\node\npm.cmd run dev
```

API: `http://localhost:4000`

Swagger UI: `http://localhost:4000/docs`

Health check: `http://localhost:4000/health`

## Useful Commands

```powershell
.\.tools\node\npm.cmd run typecheck
.\.tools\node\npm.cmd run build
.\.tools\node\npm.cmd test
.\.tools\node\npm.cmd run test:integration
.\.tools\node\npm.cmd run test:all
.\.tools\node\npm.cmd run prisma:generate
.\.tools\node\npm.cmd run prisma:studio
.\.tools\node\npm.cmd run jobs:spam-score
.\.tools\node\npm.cmd run jobs:ai-embeddings
.\.tools\node\npm.cmd run docs:openapi
.\.tools\node\npm.cmd audit
```

## Seed Users

After `db:seed`, these users exist:

- `maya@puzzle.dev`
- `leo@puzzle.dev`
- `anika@puzzle.dev`
- `mod@puzzle.dev`

Password for all seed users:

```text
Puzzle123!
```

## Current Local Status

Docker Compose has been verified with:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- `GET /health` returning database and Redis as healthy

The initial Prisma migration has been applied to the local Docker PostgreSQL database.

## Media Pipeline

Uploads are processed before storage:

- JPEG/PNG/WebP only
- content-based MIME detection
- metadata stripped by re-encoding
- main image stored as WebP
- thumbnail variant generated
- database stores provider metadata and can use local, Cloudflare R2, or S3-compatible storage without changing client contracts
- `LOCAL` serves files from `storage/uploads` through `/media/...`
- `R2`/`S3` can use the same `/media/...` URLs through a backend proxy for early testing
- production can switch `MEDIA_PUBLIC_BASE_URL` or `PUBLIC_MEDIA_URL` to a CDN/custom domain without changing API responses
- `POST /media/upload-url` reserves the future direct-upload contract; multipart `POST /media` remains the safe path because it preserves compression and moderation

## Reliability Foundations

- Endpoint-specific Redis rate limits for auth writes, search, feed events, media, comments, reports, and sharing
- `Idempotency-Key` support on mobile write flows where retries can create duplicates
- Normalized `ContentCounter` table for fast feed card counts
- Request timing logs with slow-request warnings
- `JobRun` history for background/admin jobs

## Main API Areas

- `POST /auth/register`
- `GET /auth/username-availability`
- `POST /auth/login`
- `POST /auth/apple`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/email/request-verification`
- `POST /auth/email/verify`
- `POST /auth/password/forgot`
- `POST /auth/password/reset`
- `GET /auth/sessions`
- `DELETE /auth/sessions/:id`
- `POST /auth/logout-all`
- `GET /books/search`
- `POST /books/import`
- `GET /books/:id/similar`
- `POST /books/:id/similar/recompute`
- `GET /me/shelves`
- `PUT /me/shelves/:bookId`
- `POST /articles`
- `POST /articles/:id/publish`
- `POST /reviews`
- `POST /reviews/:id/publish`
- `POST /notes`
- `GET /comments`
- `POST /comments`
- `PATCH /comments/:id`
- `DELETE /comments/:id`
- `GET /me/bookmarks`
- `POST /bookmarks/toggle`
- `GET /me/blocks`
- `POST /users/:id/block`
- `DELETE /users/:id/block`
- `GET /me/mutes`
- `POST /users/:id/mute`
- `DELETE /users/:id/mute`
- `GET /feed`
- `GET /home`
- `GET /reading-now/me`
- `GET /reading-now/friends`
- `POST /feed/events`
- `POST /share`
- `POST /media/upload-url`
- `POST /media`
- `POST /stories`
- `GET /stories/book-candidates`
- `GET /stories/friends`
- `POST /stories/:id/view`
- `GET /conversations`
- `POST /conversations/direct`
- `POST /conversations/:id/messages`
- `GET /explore`
- `GET /search`
- `GET /notifications`
- `POST /device-tokens`
- `DELETE /device-tokens`
- `POST /reports`
- `GET /moderation/queue`
- `POST /moderation/jobs/spam-score`
- `POST /moderation/jobs/maintenance`
- `GET /ai/readiness`
- `GET /ai/embeddings`
- `POST /ai/jobs/embeddings`
- `GET /admin/stats`
- `GET /admin/users`
- `GET /admin/content-scores`
- `GET /admin/job-runs`
- `GET /admin`

Current ranking/safety algorithms:

- Feed: `behavioral_ranking_v2`, `cold_start_v1`
- Explore: `moderated_quality_trending_diversity_v1`
- Search: `trigram_text_relevance_quality_v2`
- Stories: unseen/mutual/shared-book/freshness ordering
- Book similarity: metadata plus shared shelf/review users
- Chats: block-aware access checks plus Redis rate limiting
- Anti-spam: manual `jobs:spam-score` / `POST /moderation/jobs/spam-score`
- Jobs: optional background runner with Redis locks
- Reliability: endpoint rate limits, idempotency keys, normalized counters, request timing, job run history
- Media: `LOCAL`, `R2`, and `S3` providers
- AI prep: provider abstraction, embedding storage, local hash dev provider, OpenAI-compatible embedding endpoint mode

## Home Server Guide

[docs/HOME_SERVER_DEPLOYMENT.md](docs/HOME_SERVER_DEPLOYMENT.md)

## Production Notes

[docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md)

## AI Deployment Prep

[docs/AI_DEPLOYMENT_PREP.md](docs/AI_DEPLOYMENT_PREP.md)

## SwiftUI Agent Handoff

For the Codex agent working on the Mac VM / SwiftUI client, use:

[docs/MAC_SWIFTUI_AGENT_HANDOFF.md](docs/MAC_SWIFTUI_AGENT_HANDOFF.md)

It contains the endpoint catalog, DTO guidance, auth flow, seed users, realtime events, Bookgram-specific behavior, and known backend gaps.

## Realtime

Connect Socket.io with the access token:

```ts
io("http://localhost:4000", {
  auth: { token: accessToken }
});
```

Events emitted by backend:

- `conversation:created`
- `message:new`
- `conversation:read`
- `typing`
