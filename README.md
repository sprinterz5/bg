# Bookgram

Social reading app: people publish short articles and everyday stories, others read, like and follow.

## Repository

| Path | What |
| --- | --- |
| `apps/backend` | Fastify + TypeScript API, Prisma/Postgres, Redis, Socket.IO — see [apps/backend/README.md](apps/backend/README.md) |
| `apps/mobile` | React Native / Expo app for iOS and Android — see [apps/mobile/README.md](apps/mobile/README.md) |
| `docs` | Backend guides, deployment notes, OpenAPI spec, design references (`docs/design`) |

## Environment (Linux)

- System Node (22+) and npm: plain `npm run <script>` / `npx` from the app folder. Run `npm ci` in `apps/backend` and `apps/mobile` after cloning.
- Postgres and Redis for local backend work run in containers (`apps/backend/docker-compose.yml`) via `podman compose` (needs `podman-compose`) or `docker compose`. Integration tests return 500s when they are not running.
- No Mac: iOS is tested on a real iPhone (Expo Go / dev build), release builds go through EAS Build.
