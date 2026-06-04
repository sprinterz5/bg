# Puzzle Backend

Backend for Puzzle: a social network around books, articles, reviews, reading shelves, stories, notes, chats, and moderated Explore.

## Stack

- Node.js + TypeScript
- Fastify REST API
- Socket.io realtime
- PostgreSQL + Prisma
- Redis for feed cache and realtime degradation path
- Google Books API with Open Library fallback
- Local media storage for MVP

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

## Main API Areas

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/apple`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /books/search`
- `POST /books/import`
- `GET /me/shelves`
- `PUT /me/shelves/:bookId`
- `POST /articles`
- `POST /articles/:id/publish`
- `POST /reviews`
- `POST /reviews/:id/publish`
- `POST /notes`
- `GET /feed`
- `POST /media`
- `POST /stories`
- `GET /stories/friends`
- `POST /stories/:id/view`
- `GET /conversations`
- `POST /conversations/direct`
- `POST /conversations/:id/messages`
- `GET /explore`
- `GET /moderation/queue`

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
