# R2 Media Setup

Bookgram supports Cloudflare R2 through the same media contract used by local storage.

## Development / Private Testing

Use R2 as the storage provider, but keep media URLs pointed at the API:

```text
MEDIA_STORAGE_PROVIDER=R2
MEDIA_BUCKET=bookgram-media
MEDIA_REGION=auto
MEDIA_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
MEDIA_ACCESS_KEY_ID=<key>
MEDIA_SECRET_ACCESS_KEY=<secret>
PUBLIC_MEDIA_URL=http://localhost:4000/media
MEDIA_PUBLIC_BASE_URL=
```

Uploads still go through `POST /media`, so the backend can:

- verify the real image type
- strip metadata by re-encoding
- resize the main image
- generate a thumbnail
- run media moderation hooks
- store both objects in R2

When `PUBLIC_MEDIA_URL` points to the API host, `GET /media/...` is proxied from R2/S3 by the backend. This is good enough for early testing, but it uses your API server bandwidth.

## Production

Before public launch, connect a Cloudflare custom domain to the R2 bucket and use it for media URLs:

```text
MEDIA_PUBLIC_BASE_URL=https://media.example.com
PUBLIC_MEDIA_URL=https://media.example.com
```

The SwiftUI app should not change. It should always render the `url` returned by the API.

## Direct Uploads

`POST /media/upload-url` is intentionally still a reserved contract. Direct client uploads are not enabled yet because they would bypass backend image compression and moderation unless we add a separate finalize/processing job.
