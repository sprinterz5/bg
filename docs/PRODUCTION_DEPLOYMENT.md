# Bookgram Production Deployment Notes

This is a practical baseline for a first VPS or home-server deployment.

APNs and SMTP are intentionally left as provider-specific integrations.

## Files

- `Dockerfile` - API image
- `docker-compose.prod.yml` - API + PostgreSQL + Redis
- `.dockerignore` - production build context
- `scripts/backup-postgres.ps1` - PostgreSQL backup
- `scripts/restore-postgres.ps1` - PostgreSQL restore

## Build

```powershell
docker compose -f docker-compose.prod.yml build
```

## Run

```powershell
docker compose -f docker-compose.prod.yml up -d
```

## Migrate

Run migrations inside the API container:

```powershell
docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
```

## Required Environment

Set strong secrets:

```text
NODE_ENV=production
DATABASE_URL=postgresql://bookgram:strong-password@postgres:5432/bookgram?schema=public
REDIS_URL=redis://redis:6379
JWT_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<another-long-random-secret>
API_BASE_URL=https://api.example.com
PUBLIC_MEDIA_URL=https://media.example.com
CORS_ORIGIN=https://app.example.com
```

`docker-compose.prod.yml` overrides `DATABASE_URL`, `REDIS_URL`, and `NODE_ENV` for the API container so it talks to the Compose service names instead of localhost.

## Jobs

Keep jobs disabled until the deployment is stable:

```text
JOB_RUNNER_ENABLED=false
```

Then enable:

```text
JOB_RUNNER_ENABLED=true
JOB_RUN_ON_STARTUP=false
```

## Media

For local disk:

```text
MEDIA_STORAGE_PROVIDER=LOCAL
MEDIA_STORAGE_DIR=storage/uploads
```

For Cloudflare R2:

```text
MEDIA_STORAGE_PROVIDER=R2
MEDIA_BUCKET=<bucket>
MEDIA_REGION=auto
MEDIA_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
MEDIA_ACCESS_KEY_ID=<key>
MEDIA_SECRET_ACCESS_KEY=<secret>
MEDIA_PUBLIC_BASE_URL=https://media.example.com
PUBLIC_MEDIA_URL=https://media.example.com
```

For early private testing you can leave `PUBLIC_MEDIA_URL=http://<api-host>:4000/media`.
In that mode the API proxies `GET /media/...` from R2/S3. Before public launch, prefer
a Cloudflare custom domain such as `https://media.example.com` so media is served by
Cloudflare instead of your Node.js process.

## Backups

Development container names:

```powershell
.\scripts\backup-postgres.ps1
```

Production compose container name:

```powershell
.\scripts\backup-postgres.ps1 -Container bookgram-postgres -Database bookgram -User bookgram
```

Restore:

```powershell
.\scripts\restore-postgres.ps1 -InputPath .\backups\bookgram-YYYYMMDD-HHMMSS.sql
```

## Admin

Internal dashboard:

```text
GET /admin
```

It requires a moderator/admin bearer token entered in the page.

API:

```text
GET /admin/stats
GET /admin/users
GET /admin/content-scores
PATCH /admin/users/:id/role
```

## OpenAPI Export

```powershell
.\.tools\node\npm.cmd run docs:openapi
```

Output:

```text
docs/openapi.json
```

## Security Checklist

- Do not expose PostgreSQL or Redis publicly.
- Put HTTPS in front of the API.
- Use strong JWT secrets.
- Use private admin accounts only.
- Run backups before upgrades.
- Prefer R2/S3 for media before inviting testers.
- Keep APNs/SMTP credentials out of git.
