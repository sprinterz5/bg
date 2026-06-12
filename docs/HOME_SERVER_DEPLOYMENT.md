# Bookgram Home Server Deployment Guide

This guide is for private testing from a Windows home machine.

## What You Need

- Windows machine that can stay on
- Docker Desktop
- Bookgram backend in `C:\Users\begot\Documents\ProjectRed`
- Router access if you want public internet access
- A backup plan before inviting users

For early testing, prefer a private tunnel over opening router ports.

Recommended private options:

- Tailscale
- Cloudflare Tunnel
- local network only from Mac VM/iPhone simulator

## Local Development Run

```powershell
cd C:\Users\begot\Documents\ProjectRed
docker compose up -d
.\.tools\node\npm.cmd run prisma:migrate
.\.tools\node\npm.cmd run dev
```

Health:

```text
http://localhost:4000/health
```

Swagger:

```text
http://localhost:4000/docs
```

## Mac VM / iPhone Base URL

Inside the Mac VM, `localhost` is the Mac VM, not Windows.

Use the Windows host LAN IP:

```text
http://<WINDOWS_HOST_IP>:4000
```

Set backend env:

```text
API_BASE_URL=http://<WINDOWS_HOST_IP>:4000
PUBLIC_MEDIA_URL=http://<WINDOWS_HOST_IP>:4000/media
CORS_ORIGIN=*
```

## Background Jobs

Background jobs are disabled by default.

Enable:

```text
JOB_RUNNER_ENABLED=true
JOB_RUN_ON_STARTUP=false
JOB_SPAM_SCORE_INTERVAL_MINUTES=60
JOB_MAINTENANCE_INTERVAL_MINUTES=30
```

Jobs:

- `spam-score`: updates spam/quality/trending scores.
- `maintenance`: expires old stories and recomputes recent book similarity.

Manual command:

```powershell
.\.tools\node\npm.cmd run jobs:spam-score
```

Moderator endpoints:

```text
POST /moderation/jobs/spam-score
POST /moderation/jobs/maintenance
```

## Local Media

Default:

```text
MEDIA_STORAGE_PROVIDER=LOCAL
MEDIA_STORAGE_DIR=storage/uploads
PUBLIC_MEDIA_URL=http://<host>:4000/media
```

Keep `storage/uploads` backed up if you use local media.

## Cloudflare R2 Later

Set:

```text
MEDIA_STORAGE_PROVIDER=R2
MEDIA_BUCKET=<bucket>
MEDIA_REGION=auto
MEDIA_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
MEDIA_ACCESS_KEY_ID=<r2-access-key>
MEDIA_SECRET_ACCESS_KEY=<r2-secret-key>
MEDIA_PUBLIC_BASE_URL=https://<public-media-domain>
PUBLIC_MEDIA_URL=https://<public-media-domain>
```

If the public media domain is not ready, keep `PUBLIC_MEDIA_URL=http://<host>:4000/media`.
The backend will proxy `/media/...` from R2/S3, which is fine for private testing.
The SwiftUI app should only use returned `url` fields. It should not know whether media is local, proxied R2, or CDN-backed R2.

## PostgreSQL Backups

Create a backup:

```powershell
docker exec puzzle-postgres pg_dump -U puzzle -d puzzle > bookgram-backup.sql
```

Restore into a fresh database:

```powershell
Get-Content .\bookgram-backup.sql | docker exec -i puzzle-postgres psql -U puzzle -d puzzle
```

Keep backups outside the project folder too.

## Security Notes

Before public testers:

- Use HTTPS.
- Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET`.
- Do not expose PostgreSQL or Redis ports to the internet.
- Use a tunnel or reverse proxy for API only.
- Keep Docker Desktop updated.
- Run backups.
- Move media to R2 before storage grows.

## Suggested Path

1. Local Windows backend for development.
2. Mac VM / simulator connects to Windows LAN IP.
3. Tailscale or Cloudflare Tunnel for private iPhone testing.
4. R2 for media.
5. VPS when external testers appear.
