# Bookgram

Social reading app: people publish short articles and everyday stories, others read, like and follow.

## Repository

| Path | What |
| --- | --- |
| `apps/backend` | Fastify + TypeScript API, Prisma/Postgres, Redis, Socket.IO — see [apps/backend/README.md](apps/backend/README.md) |
| `apps/mobile` | React Native / Expo app for iOS and Android — see [apps/mobile/README.md](apps/mobile/README.md) |
| `docs` | Backend guides, deployment notes, OpenAPI spec, design references (`docs/design`) |

`docs/MAC_SWIFTUI_AGENT_HANDOFF.md` is obsolete: the client is React Native, not SwiftUI.

## Environment (Windows)

- Node 24 + npm 11 live in `.tools/node` (portable, git-ignored); there is no system Node. Call it directly, e.g. from `apps/backend`: `../../.tools/node/npm.cmd run typecheck`, or prepend it to PATH for `npx`.
- Postgres and Redis run in Docker (`apps/backend/docker-compose.yml`). Integration tests return 500s when Docker is off.
- No Mac: iOS is tested on a real iPhone (Expo Go / dev build), release builds go through EAS Build.
