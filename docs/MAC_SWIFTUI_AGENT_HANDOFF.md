# Bookgram Mac SwiftUI Agent Handoff

This document is for a separate Codex agent working on the iOS SwiftUI app on the Mac VM.
It explains what the backend already exposes, how the app should call it, and what still does not exist.

## Product Summary

Bookgram is an iOS-first social reading network.

Core idea: content revolves around books and ideas, not influencer profiles.

Main surfaces:

- Home feed: For You and Following
- Stories: friends' current reading, with hidden book title until viewed
- Articles: Medium-like posts
- Reviews: book-bound posts
- Notes: user highlights inside articles/reviews
- Explore: moderated recommendations only
- Profile: reading shelves, notes, authored content
- Chats: direct messages and sharing books/articles/reviews

## Backend Location

Windows backend workspace:

```text
C:\Users\begot\Documents\ProjectRed
```

Run backend on Windows:

```powershell
cd C:\Users\begot\Documents\ProjectRed
docker compose up -d
.\.tools\node\npm.cmd run dev
```

Swagger:

```text
http://localhost:4000/docs
```

Health:

```text
GET http://localhost:4000/health
```

If the iOS simulator runs inside a Mac VM, `localhost` means the Mac VM, not Windows.
Set the iOS base URL to the Windows host IP, for example:

```text
http://<WINDOWS_HOST_IP>:4000
```

Also set backend `.env`:

```text
PUBLIC_MEDIA_URL=http://<WINDOWS_HOST_IP>:4000/media
CORS_ORIGIN=*
```

For early local development, HTTP is acceptable. For physical iPhone testing, HTTPS or a trusted local tunnel may be needed later.

## Seed Accounts

Seed command:

```powershell
.\.tools\node\npm.cmd run db:seed
```

Users:

```text
maya@puzzle.dev
leo@puzzle.dev
anika@puzzle.dev
mod@puzzle.dev
```

Password:

```text
Puzzle123!
```

`mod@puzzle.dev` has role `MODERATOR`.

## Auth Model

The iOS app should use bearer JWT auth.

Token response shape:

```json
{
  "user": {},
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "tokenType": "Bearer"
}
```

iOS storage:

- Keep `accessToken` in memory and Keychain.
- Keep `refreshToken` in Keychain.
- On `401`, call `POST /auth/refresh`.
- Replace both tokens from refresh response.
- Retry the failed request once.
- If refresh fails, clear tokens and show login.
- Usernames are normalized to lowercase by the backend.
- Use `GET /auth/username-availability?username=<candidate>` for signup UI hints.
- Registration can still return a conflict if another client takes the username first.

Session management is for mobile devices, not web cookies.
Each login/refresh creates a stored refresh-token session.
The iOS app can show active devices later, but this is not required for MVP UI.

## Mobile Reliability Contract

For write requests that may be retried by iOS after a timeout or poor network, send an `Idempotency-Key` header.

Recommended Swift shape:

```text
Idempotency-Key: UUID().uuidString
```

Use one stable key per user action, not one key per HTTP retry.

Supported now:

```text
POST /comments
POST /reports
POST /stories
POST /share
POST /conversations/:id/messages
POST /media
```

If the same key, user, method, path, and body are repeated after success, the backend replays the first response.
If the same key is reused with a different body, backend returns conflict.

Several endpoints also have endpoint-specific rate limits. Treat `429` as a normal retry-after/backoff case in the client.

## Enums

Use raw string enums in Swift.

```text
UserRole: USER, MODERATOR, ADMIN
BookSource: GOOGLE_BOOKS, OPEN_LIBRARY, MANUAL
ShelfStatus: READING, READ, WANT_TO_READ
ArticleStatus: DRAFT, PUBLISHED, ARCHIVED, REMOVED
ReviewStatus: DRAFT, PUBLISHED, ARCHIVED, REMOVED
ModerationStatus: NOT_REQUIRED, PENDING, APPROVED, REJECTED
StoryStatus: ACTIVE, EXPIRED, DELETED
LikeTargetType: ARTICLE, REVIEW, STORY, NOTE, COMMENT
CommentTargetType: ARTICLE, REVIEW
BookmarkTargetType: ARTICLE, REVIEW, BOOK, NOTE
ContentScoreTargetType: ARTICLE, REVIEW
NoteTargetType: ARTICLE, REVIEW
ConversationType: DIRECT, GROUP
MessageType: TEXT, SHARE_BOOK, SHARE_ARTICLE, SHARE_REVIEW, SYSTEM
MediaKind: AVATAR, ARTICLE_COVER, STORY_IMAGE, CHAT_ATTACHMENT, BOOK_COVER_CACHE
ReportTargetType: USER, ARTICLE, REVIEW, STORY, MESSAGE, NOTE, COMMENT
ReportReason: SPAM, HARASSMENT, HATE, SEXUAL_CONTENT, VIOLENCE, COPYRIGHT, AI_SLOP, MISINFORMATION, OTHER
ReportStatus: OPEN, UNDER_REVIEW, RESOLVED, DISMISSED
ReportResolution: CONTENT_REMOVED, USER_WARNED, USER_SUSPENDED, NO_VIOLATION, DUPLICATE, OTHER
FeedEventType: IMPRESSION, OPEN, READ_PROGRESS, DWELL_TIME, LIKE, SAVE, HIDE, SHARE, BOOKMARK, COMMENT
FeedEventTargetType: ARTICLE, REVIEW, BOOK, STORY
NotificationType: FOLLOW, LIKE, COMMENT, COMMENT_REPLY, NOTE_REPLY, MESSAGE, STORY_VIEW, MODERATION_APPROVED, MODERATION_REJECTED, REPORT_RESOLVED, BOOKMARK, SYSTEM
NotificationTargetType: USER, ARTICLE, REVIEW, BOOK, STORY, MESSAGE, REPORT, CONVERSATION, COMMENT, SYSTEM
MediaStorageProvider: LOCAL, R2, S3
MediaVariantKind: THUMBNAIL, PREVIEW
Platform: IOS, ANDROID
AiEmbeddingTargetType: ARTICLE, REVIEW, BOOK
AiEmbeddingStatus: PENDING, READY, FAILED
```

## Endpoint Catalog

All endpoints returning dates use ISO strings.
All IDs are UUID strings unless stated otherwise.

### Health

#### `GET /health`

Auth: no

Response:

```json
{
  "status": "ok",
  "services": {
    "database": true,
    "redis": true
  }
}
```

### Auth

#### `POST /auth/register`

Auth: no

Request:

```json
{
  "email": "reader@example.com",
  "username": "reader_1",
  "displayName": "Reader",
  "password": "Puzzle123!",
  "interests": ["fiction", "ideas"]
}
```

Response: `AuthResponse`

Registration starts email verification. In development/test responses may include:

```json
{
  "devEmailVerificationToken": "token"
}
```

Production will not expose this token; it will be sent by email.

#### `GET /auth/username-availability`

Auth: no

Query:

```text
username=reader_1
```

Response:

```json
{
  "username": "Reader_1",
  "normalizedUsername": "reader_1",
  "available": true,
  "reason": null,
  "suggestions": []
}
```

When unavailable, `reason` is `invalid_format`, `reserved`, or `taken`.

#### `POST /auth/login`

Auth: no

Request:

```json
{
  "login": "maya@puzzle.dev",
  "password": "Puzzle123!"
}
```

Response: `AuthResponse`

#### `POST /auth/apple`

Auth: no

Request:

```json
{
  "identityToken": "apple_identity_token",
  "username": "optional_new_username",
  "displayName": "optional",
  "interests": ["fiction"]
}
```

Backend validates Apple token against `APPLE_CLIENT_ID`.

Response: `AuthResponse`

#### `GET /auth/me`

Auth: bearer

Response: `UserDTO`

`UserDTO` includes `emailVerified`.

#### `POST /auth/email/request-verification`

Auth: bearer

Sends a new verification email for current user.

Development/test response may include `devEmailVerificationToken`.

#### `POST /auth/email/verify`

Auth: no

Request:

```json
{
  "token": "verification-token"
}
```

Response:

```json
{
  "ok": true,
  "user": {}
}
```

#### `POST /auth/password/forgot`

Auth: no

Request:

```json
{
  "email": "reader@example.com"
}
```

Always returns `202` with `{ "ok": true }` to avoid account enumeration.
Development/test response may include `devPasswordResetToken`.

#### `POST /auth/password/reset`

Auth: no

Request:

```json
{
  "token": "reset-token",
  "password": "NewPassword123!"
}
```

Resets password and revokes active refresh-token sessions.

#### `POST /auth/refresh`

Auth: no

Request:

```json
{
  "refreshToken": "refresh_jwt"
}
```

Response: `AuthResponse`

Important: backend rotates refresh tokens. Store the new refresh token.

#### `POST /auth/logout`

Auth: no

Request:

```json
{
  "refreshToken": "refresh_jwt"
}
```

Response:

```json
{ "ok": true }
```

#### `GET /auth/sessions`

Auth: bearer

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "userAgent": "Bookgram iOS/1.0",
      "ipAddress": "127.0.0.1",
      "createdAt": "iso",
      "expiresAt": "iso"
    }
  ]
}
```

#### `DELETE /auth/sessions/:id`

Auth: bearer

Revokes a specific active refresh-token session owned by current user.

Response:

```json
{ "ok": true }
```

#### `POST /auth/logout-all`

Auth: bearer

Request:

```json
{
  "keepRefreshToken": "optional_current_refresh_jwt"
}
```

If `keepRefreshToken` is omitted, all active refresh-token sessions are revoked.
If present, every other active session is revoked.

Response:

```json
{ "ok": true }
```

### Users and Follows

#### `GET /users/:username`

Auth: no

Returns public profile, counts, recent shelf items, and active story marker.

#### `PATCH /users/me`

Auth: bearer

Request:

```json
{
  "displayName": "Maya",
  "bio": "Reader",
  "avatarUrl": "https://...",
  "interests": ["fiction", "history"]
}
```

#### `POST /users/:id/follow`

Auth: bearer

Response: `{ "ok": true }`

#### `DELETE /users/:id/follow`

Auth: bearer

Response: `{ "ok": true }`

### Books

#### `GET /books/search?q=dune`

Auth: no

Searches Google Books first. If too few results, adds Open Library fallback results.

Response:

```json
{
  "data": [
    {
      "source": "GOOGLE_BOOKS",
      "googleBooksId": "id",
      "openLibraryKey": null,
      "isbn10": "string",
      "isbn13": "string",
      "title": "Dune",
      "subtitle": null,
      "authors": ["Frank Herbert"],
      "description": "text",
      "thumbnailUrl": "https://...",
      "language": "en",
      "publishedDate": "1965",
      "publisher": "Ace",
      "pageCount": 688,
      "categories": ["Science Fiction"],
      "rawJson": {}
    }
  ]
}
```

#### `POST /books/import`

Auth: bearer

Request one of:

```json
{ "googleBooksId": "id" }
```

```json
{ "openLibraryKey": "/works/..." }
```

```json
{ "isbn": "9780441172719" }
```

Response: `BookDTO` stored in Bookgram DB.

#### `GET /books/:id/similar?limit=10`

Auth: no

Returns similar books from the local similarity graph. If no graph rows exist yet, backend computes a first batch from shared authors/categories/language/publisher.

#### `POST /books/:id/similar/recompute?limit=25`

Auth: bearer

Recomputes local similarity rows for one book. Use this in admin/dev tooling, not normal app scrolling.

#### `GET /books/:id`

Auth: no

Response: `BookDTO` plus `_count`.

### Shelves

#### `GET /me/shelves?status=READING`

Auth: bearer

`status` optional.

Response: array of `ShelfItemDTO` with `book`.

#### `PUT /me/shelves/:bookId`

Auth: bearer

Request:

```json
{
  "status": "READING",
  "rating": 5,
  "progressPage": 120,
  "progressPercent": 35,
  "privateNote": "optional",
  "startedAt": "iso",
  "finishedAt": "iso"
}
```

Response: `ShelfItemDTO` with `book`.

#### `DELETE /me/shelves/:bookId`

Auth: bearer

Response: `{ "ok": true }`

### Articles

#### `POST /articles`

Auth: bearer

Creates draft article.

Request:

```json
{
  "title": "Title",
  "subtitle": "optional",
  "excerpt": "optional",
  "body": "full text",
  "coverImageUrl": "https://...",
  "tags": ["ideas"]
}
```

Response: `ArticleDTO`

#### `GET /me/articles?limit=20&cursor=<id>`

Auth: bearer

Response:

```json
{
  "data": [ArticleDTO],
  "nextCursor": "id-or-null"
}
```

#### `GET /articles?limit=20&cursor=<id>`

Auth: no

Only published and approved articles.

#### `GET /articles/:idOrSlug`

Auth: no

Only published and approved articles.

#### `PATCH /articles/:id`

Auth: bearer, author only

Partial article update.

#### `POST /articles/:id/publish`

Auth: bearer, author only

Moves article to:

```text
status=PUBLISHED
moderationStatus=PENDING
```

It will not appear in public list, feed, or Explore until moderation approves it.

#### `DELETE /articles/:id`

Auth: bearer, author only

Archives/soft-deletes article.

### Reviews

#### `POST /reviews`

Auth: bearer

Request:

```json
{
  "bookId": "uuid",
  "title": "Review title",
  "body": "Review body",
  "rating": 5,
  "tags": ["science fiction"]
}
```

Response: `ReviewDTO` with `book`.

#### `GET /me/reviews?limit=20&cursor=<id>`

Auth: bearer

#### `GET /reviews?bookId=<uuid>&limit=20&cursor=<id>`

Auth: no

Only published and approved reviews.
`bookId` optional.

#### `GET /reviews/:id`

Auth: no

Only published and approved review.

#### `PATCH /reviews/:id`

Auth: bearer, author only

#### `POST /reviews/:id/publish`

Auth: bearer, author only

Moves review to moderation pending.

#### `DELETE /reviews/:id`

Auth: bearer, author only

### Notes

#### `GET /me/notes?limit=20&cursor=<id>`

Auth: bearer

Returns saved notes with article/review preview.

#### `POST /notes`

Auth: bearer

Request:

```json
{
  "targetType": "ARTICLE",
  "targetId": "uuid",
  "selectedText": "highlighted text",
  "noteText": "my note",
  "anchorStart": 120,
  "anchorEnd": 180
}
```

`targetType` can be `ARTICLE` or `REVIEW`.

#### `PATCH /notes/:id`

Auth: bearer, owner only

Request:

```json
{
  "noteText": "updated note",
  "selectedText": "optional updated selected text",
  "anchorStart": 120,
  "anchorEnd": 180
}
```

#### `DELETE /notes/:id`

Auth: bearer, owner only

### Likes

#### `POST /likes/toggle`

Auth: bearer

Request:

```json
{
  "targetType": "ARTICLE",
  "targetId": "uuid"
}
```

Response:

```json
{ "liked": true }
```

### Comments

#### `GET /comments?targetType=ARTICLE&targetId=<uuid>&limit=20&cursor=<id>`

Auth: bearer

Returns non-deleted comments for an approved article/review. Add `parentId=<commentId>` to load replies.

#### `POST /comments`

Auth: bearer

Request:

```json
{
  "targetType": "ARTICLE",
  "targetId": "uuid",
  "parentId": "optional_reply_parent_uuid",
  "body": "comment text"
}
```

Creates comment/reply, updates content score, and sends comment notifications.

#### `PATCH /comments/:id`

Auth: bearer, owner only

#### `DELETE /comments/:id`

Auth: bearer, owner/moderator/admin

Soft-deletes the comment.

### Bookmarks

#### `GET /me/bookmarks?targetType=ARTICLE&limit=20&cursor=<id>`

Auth: bearer

`targetType` optional: `ARTICLE | REVIEW | BOOK | NOTE`.

#### `POST /bookmarks/toggle`

Auth: bearer

Request:

```json
{
  "targetType": "ARTICLE",
  "targetId": "uuid"
}
```

Response:

```json
{
  "bookmarked": true
}
```

Article/review bookmarks update `ContentScore.saves` and notify the author.

### Blocks and Mutes

#### `GET /me/blocks`

Auth: bearer

#### `POST /users/:id/block`

Auth: bearer

Creates block, removes follows in both directions, removes any mute, and invalidates feed cache.

#### `DELETE /users/:id/block`

Auth: bearer

#### `GET /me/mutes`

Auth: bearer

#### `POST /users/:id/mute`

Auth: bearer

Hides the user's content from current user's feed without unfollowing.

#### `DELETE /users/:id/mute`

Auth: bearer

### Feed

#### `GET /feed?mode=for_you&filter=all&limit=20&before=<iso>`

Auth: bearer

Query:

```text
mode: for_you | following
filter: all | articles | books
limit: 1..50
before: optional ISO date
```

Response:

```json
{
  "data": [
    {
      "id": "article:uuid",
      "targetType": "ARTICLE",
      "targetId": "uuid",
      "title": "Title",
      "excerpt": "text",
      "coverImageUrl": "https://...",
      "tags": ["ideas"],
      "author": {},
      "publishedAt": "iso",
      "readingTimeMinutes": 2,
      "score": 105
    }
  ],
  "nextCursor": "iso-or-null",
  "algorithm": "behavioral_ranking_v2"
}
```

For review/book items, `targetType` is `REVIEW` and item includes `book`.

Important: `books` filter means book-related reviews, not videos.

Feed items are frontend-friendly and include:

```json
{
  "media": {
    "kind": "BOOK_COVER",
    "url": "https://...",
    "thumbnailUrl": "https://...",
    "aspectRatio": 0.66,
    "width": null,
    "height": null
  },
  "viewer": {
    "liked": false,
    "bookmarked": true
  },
  "counts": {
    "likes": 10,
    "comments": 2,
    "bookmarks": 4,
    "shares": 1
  }
}
```

For articles without a cover, `media` can be `null`.

### Home

#### `GET /home?feedMode=for_you&feedFilter=all&feedLimit=20&readingNowLimit=20`

Auth: bearer

Aggregates the first Home screen:

```json
{
  "viewer": {},
  "notifications": {
    "unreadCount": 0
  },
  "readingNow": {
    "me": null,
    "friends": []
  },
  "feed": {
    "data": [],
    "nextCursor": null,
    "algorithm": "behavioral_ranking_v2"
  }
}
```

Use this for the initial Home load. Use `/feed` for pagination/refresh after that.

### Reading Now

#### `GET /reading-now/me`

Auth: bearer

Returns the current user's latest `READING` shelf item with book and normalized media.

#### `GET /reading-now/friends?limit=20`

Auth: bearer

Returns followed users' `READING` shelf items, excluding blocked/muted users.

### Feed Events

#### `POST /feed/events`

Auth: bearer

Send one event:

```json
{
  "eventType": "OPEN",
  "targetType": "ARTICLE",
  "targetId": "uuid",
  "source": "home_for_you",
  "dwellMs": 1200,
  "progress": 50,
  "metadata": {
    "position": 3
  }
}
```

Or send a batch:

```json
{
  "events": [
    {
      "eventType": "IMPRESSION",
      "targetType": "REVIEW",
      "targetId": "uuid",
      "source": "home_following"
    }
  ]
}
```

Response:

```json
{
  "ok": true,
  "count": 1
}
```

Use this from SwiftUI for card appearances, content opens, read progress, dwell time, hides, and shares.
These events now update `ContentScore`, which feeds ranking and Explore improvements.

#### `GET /me/feed-events/summary`

Auth: bearer

Debug endpoint for current user's event counts.

### Media

#### `POST /media/upload-url`

Auth: bearer

Future direct-upload contract for R2/S3. Since the current project is intentionally on local media storage, this returns `501` with fallback instructions:

```json
{
  "error": "direct_upload_not_available",
  "message": "Direct upload URLs are only available for R2/S3 storage. Use POST /media for local storage.",
  "fallback": {
    "method": "POST",
    "url": "/media",
    "multipart": true,
    "kind": "STORY_IMAGE"
  }
}
```

SwiftUI should call multipart `POST /media` for now.
Keep this route in the upload abstraction so later direct-upload support only changes the upload implementation, not story/article creation.

#### `POST /media`

Auth: bearer

Multipart form:

```text
file: binary
kind: AVATAR | ARTICLE_COVER | STORY_IMAGE | CHAT_ATTACHMENT | BOOK_COVER_CACHE
```

Response: `MediaAssetDTO`

Current backend supports local storage and R2/S3-compatible storage.
The database already stores `provider` and `bucket`.
Supported providers are `LOCAL`, `R2`, and `S3`.
The SwiftUI app should always use the returned `url` and never hardcode or manually build media paths.

Important for SwiftUI:

- In early R2 testing the returned URL may still point to the API host `/media/...`; the backend proxies the object from R2.
- In production the same field can point directly to a Cloudflare custom media domain.
- The client upload flow still uses multipart `POST /media`, so backend compression and moderation are preserved.

Current media pipeline:

- accepts JPEG, PNG, and WebP images only
- checks actual file bytes, not just client MIME/extension
- strips metadata by re-encoding through Sharp
- stores the main image as sanitized `image/webp`
- creates a `THUMBNAIL` variant as `image/webp`
- stores `width`, `height`, `byteSize`, `provider`, `bucket`, `storageKey`

Response includes:

```json
{
  "id": "uuid",
  "kind": "STORY_IMAGE",
  "provider": "LOCAL",
  "bucket": null,
  "url": "http://host:4000/media/story_image/date/id.webp",
  "storageKey": "story_image/date/id.webp",
  "mimeType": "image/webp",
  "byteSize": 12345,
  "width": 1200,
  "height": 1600,
  "variants": [
    {
      "kind": "THUMBNAIL",
      "url": "http://host:4000/media/story_image/date/id_thumb.webp",
      "mimeType": "image/webp",
      "width": 360,
      "height": 480
    }
  ]
}
```

### Stories

#### `GET /stories/book-candidates?q=dune`

Auth: bearer

Helper for story creation flow. Intended UX:

1. User opens story creation.
2. User searches books through this endpoint.
3. App imports/selects a book through `/books/import` if needed.
4. App creates story with `POST /stories` and `bookId`.

#### `POST /stories`

Auth: bearer

Request:

```json
{
  "bookId": "optional_uuid",
  "mediaUrl": "http://host:4000/media/...",
  "mediaMimeType": "image/jpeg",
  "caption": "optional"
}
```

If `bookId` is provided, backend also upserts shelf item as:

```text
status=READING
```

#### `GET /stories/me`

Auth: bearer

Returns current user's active stories with book and views.

#### `GET /stories/friends`

Auth: bearer

Returns active stories from followed users.

Bookgram-specific behavior:

- Before story is viewed: `book=null`, `caption=null`, `ringState="unseen"`.
- After story is viewed: book and caption are visible, `ringState="seen"`.
- Response includes `orderingScore`; sort is already done on backend.
- Backend hides blocked/muted users.
- Ranking favors unseen stories, mutual follows, shared books, and fresh stories.

#### `POST /stories/:id/view`

Auth: bearer

Marks story as viewed and returns full story with book.

### Chats

#### `GET /conversations`

Auth: bearer

Returns user's conversations with members and last message.

#### `POST /conversations/direct`

Auth: bearer

Request:

```json
{
  "userId": "uuid"
}
```

Creates or returns existing direct conversation.
Returns `403` if either user has blocked the other.

#### `GET /conversations/:id/messages?limit=20&cursor=<id>`

Auth: bearer, member only

Returns newest messages first.

#### `POST /conversations/:id/messages`

Auth: bearer, member only

Backend applies chat safety:

- blocked conversations are unavailable
- messages are rate-limited at roughly 30/minute and 500/day per user

Text:

```json
{
  "type": "TEXT",
  "body": "hello"
}
```

Share book:

```json
{
  "type": "SHARE_BOOK",
  "sharedBookId": "uuid"
}
```

Share article:

```json
{
  "type": "SHARE_ARTICLE",
  "sharedArticleId": "uuid"
}
```

Share review:

```json
{
  "type": "SHARE_REVIEW",
  "sharedReviewId": "uuid"
}
```

#### `POST /conversations/:id/read`

Auth: bearer, member only

Updates `lastReadAt`.

### Share

#### `POST /share`

Auth: bearer

Request:

```json
{
  "targetType": "ARTICLE",
  "targetId": "uuid",
  "conversationId": "optional_uuid",
  "body": "optional message",
  "source": "home_feed"
}
```

`targetType`: `ARTICLE | REVIEW | BOOK`

Always records a `SHARE` feed event. If `conversationId` is present, also creates a share message in that conversation and sends notifications.

### Realtime

Socket.io URL:

```text
http://<host>:4000
```

Connect with:

```js
io("http://host:4000", {
  auth: { token: accessToken }
});
```

Backend joins:

- `user:<userId>`
- all existing `conversation:<conversationId>` rooms

Client may emit:

```text
conversation:join { conversationId }
typing { conversationId }
```

Client should listen for:

```text
conversation:created
message:new
conversation:read
typing
notification:new
```

### Notifications

#### `GET /notifications?unreadOnly=false&limit=30&cursor=<id>`

Auth: bearer

Returns notification page with optional actor preview.

#### `GET /notifications/unread-count`

Auth: bearer

Response:

```json
{
  "count": 3
}
```

#### `POST /notifications/:id/read`

Auth: bearer

Marks one notification as read.

#### `POST /notifications/read-all`

Auth: bearer

Response:

```json
{
  "ok": true,
  "count": 3
}
```

Backend currently creates notifications for new followers, new messages, moderation decisions, and resolved reports.
It also creates notifications for comments, comment replies, and bookmarks.

### Device Tokens

#### `POST /device-tokens`

Auth: bearer

Request:

```json
{
  "token": "apns-device-token",
  "platform": "IOS"
}
```

Stores/reassigns a device token for future APNs support.
Current backend uses `PUSH_DELIVERY_MODE=LOG`, so push payloads are logged in development. Socket.io `notification:new` is still the realtime delivery path for MVP.

#### `DELETE /device-tokens`

Auth: bearer

Request:

```json
{
  "token": "apns-device-token"
}
```

### Reports

#### `POST /reports`

Auth: bearer

Request:

```json
{
  "targetType": "MESSAGE",
  "targetId": "uuid",
  "reason": "SPAM",
  "details": "optional details"
}
```

Response: `ReportDTO`

Users can report `USER`, `ARTICLE`, `REVIEW`, `STORY`, `MESSAGE`, `NOTE`, and `COMMENT`.

#### `GET /me/reports?limit=20&cursor=<id>`

Auth: bearer

Current user's reports.

#### `GET /reports?status=OPEN`

Auth: moderator/admin

Moderator report queue.

#### `PATCH /reports/:id`

Auth: moderator/admin

Request:

```json
{
  "status": "RESOLVED",
  "resolution": "NO_VIOLATION",
  "moderatorNote": "reviewed"
}
```

When resolved or dismissed, backend notifies the reporter.

### Internal Search

#### `GET /search?q=dune&type=all&limit=10`

Auth: bearer

`type`:

```text
all | users | books | articles | reviews
```

Response:

```json
{
  "query": "dune",
  "data": {
    "users": [],
    "books": [],
    "articles": [],
    "reviews": []
  }
}
```

Response also includes:

```json
{
  "algorithm": "trigram_text_relevance_quality_v2"
}
```

Search uses PostgreSQL trigram candidates plus backend ranking by exact/prefix/contains relevance, content quality/trending, and spam penalty.
PostgreSQL trigram indexes are already present as backend infrastructure. The endpoint contract should not need to change when fuzzy/full-text ranking becomes deeper.

### Explore

#### `GET /explore?filter=all&limit=20`

Auth: bearer

Query:

```text
filter: all | articles | books
limit: 1..50
```

Only approved moderation items appear here.

Response:

```json
{
  "algorithm": "moderated_quality_trending_diversity_v1",
  "data": [
    {
      "id": "uuid",
      "targetType": "ARTICLE",
      "score": 99,
      "content": {}
    }
  ]
}
```

Explore ranking uses moderation status, manual score, user interests, freshness, content quality/trending, spam penalty, and light author diversity.

### Moderation

MVP iOS app does not need moderator UI unless requested.
These endpoints are useful for internal tools.

#### `GET /moderation/queue`

Auth: bearer, role `MODERATOR` or `ADMIN`

#### `POST /moderation/ARTICLE/:id/approve`

Auth: moderator/admin

Request:

```json
{
  "reason": "Looks good",
  "score": 42
}
```

#### `POST /moderation/ARTICLE/:id/reject`

Auth: moderator/admin

#### `POST /moderation/REVIEW/:id/approve`

Auth: moderator/admin

#### `POST /moderation/REVIEW/:id/reject`

Auth: moderator/admin

#### `POST /moderation/jobs/spam-score`

Auth: moderator/admin

Request:

```json
{
  "limit": 200,
  "threshold": 70
}
```

Runs the MVP anti-spam scoring job. It updates `ContentScore.spamScore`, lowers quality/trending for suspicious content, and returns high-risk content to moderation/Explore review.

Response:

```json
{
  "scanned": 42,
  "flagged": 2,
  "threshold": 70,
  "data": [
    {
      "targetType": "ARTICLE",
      "targetId": "uuid",
      "title": "Title",
      "spamScore": 74,
      "thresholdExceeded": true,
      "signals": [
        { "name": "open_reports", "weight": 36, "value": 2 }
      ]
    }
  ]
}
```

The iOS MVP does not need to call this unless you build a moderator/admin screen.

#### `POST /moderation/jobs/maintenance`

Auth: moderator/admin

Request:

```json
{
  "bookLimit": 50
}
```

Expires old stories and recomputes recent book similarities.

### Admin / Ops

The iOS MVP does not need these unless you build an internal admin app.

Internal browser dashboard:

```text
GET /admin
```

#### `GET /admin/stats`

Auth: moderator/admin

Returns aggregate counts for users, moderation, reports, media, and ranking scores.

#### `GET /admin/users?q=&role=&emailVerified=&limit=25&cursor=<id>`

Auth: moderator/admin

Returns paginated user rows for admin review.

#### `GET /admin/content-scores?sort=spam&limit=25&cursor=<id>`

Auth: moderator/admin

`sort`: `spam | quality | trending | engagement`

Returns content score rows with article/review preview.

#### `GET /admin/job-runs?name=&status=&limit=25&cursor=<id>`

Auth: moderator/admin

Returns recent background/manual job runs.

`status`: `RUNNING | SUCCEEDED | FAILED`

### AI / Embeddings Ops

The iOS MVP does not call these. They are for backend/admin deployment readiness.

#### `GET /ai/readiness`

Auth: moderator/admin

Returns AI provider readiness and embedding counts.

#### `GET /ai/embeddings?targetType=&status=&limit=25`

Auth: moderator/admin

Lists embedding rows without returning the full vector.

#### `POST /ai/jobs/embeddings`

Auth: moderator/admin

Request:

```json
{
  "limit": 50,
  "targetTypes": ["ARTICLE", "REVIEW", "BOOK"]
}
```

Runs embedding backfill through the configured provider.
Current default is disabled. Development can use `AI_PROVIDER=LOCAL_HASH`; real deployment can use an OpenAI-compatible embeddings endpoint.

#### `PATCH /admin/users/:id/role`

Auth: admin

Request:

```json
{
  "role": "MODERATOR"
}
```

## Suggested SwiftUI Implementation Order

1. `Config`: base URL for Windows host IP.
2. `APIClient`: JSON request, bearer token, refresh-on-401 retry.
3. `KeychainTokenStore`: access/refresh persistence.
4. `AuthService`: login/register/me/refresh/logout.
5. `AppSession`: `ObservableObject` that owns auth state.
6. Main tab shell:
   - Home
   - Explore
   - Create
   - Chats
   - Profile
7. Book search and shelf.
8. Profile shelves and authored content.
9. Article/review reader and editor.
10. Notes selection flow.
11. Feed.
12. Stories rail and story viewer.
13. Chats REST.
14. Socket.io realtime.

## Minimal Swift DTO List

Create these first:

```text
UserDTO
AuthResponseDTO
BookDTO
ShelfItemDTO
ArticleDTO
ReviewDTO
NoteDTO
FeedPageDTO
FeedItemDTO
MediaAssetDTO
StoryDTO
ConversationDTO
ConversationMemberDTO
MessageDTO
ExploreItemDTO
PageDTO<T>
OkDTO
```

For `FeedItemDTO`, use a flexible decoder because articles and reviews have different fields.

## Known Backend Gaps

Do not block the first SwiftUI MVP on these, but know they are missing:

- Full OpenAPI request/response schemas in Fastify route definitions.
- APNs sending does not exist yet; REST notifications, Socket.io `notification:new`, and device token storage exist.
- Search now has backend relevance ranking plus PostgreSQL trigram index infrastructure, but not a deep typo-tolerant query planner yet.
- Report/abuse endpoints exist for MVP, but automatic enforcement policy does not.
- Media pipeline now handles MIME sniffing, image resizing, metadata stripping, and thumbnails locally.
- Cloudflare R2/S3 adapter exists. SwiftUI should still only use returned media `url`.
- Backend proxy for R2/S3 `/media/...` exists for early testing without a custom media domain.
- Direct upload URL route exists as a contract, but multipart upload remains the default because it preserves backend compression and moderation.
- Feed behavior event storage now updates content scores and `behavioral_ranking_v2`, but it is still an early ranking model.
- Collaborative filtering is still shallow.
- Book similarity graph uses metadata plus shared shelf/review users, but not semantic embeddings yet.
- AI embedding storage/job/provider abstraction exists, but semantic search/reranking is not yet wired into user-facing endpoints.
- MVP anti-spam scoring exists and can be scheduled by enabling the background runner, but it is still heuristic.
- Detailed home server deployment guide.

## Home Server Notes

Running backend from a home machine is possible for development and private testing.

Minimum:

- Windows host always on
- Docker Desktop running
- Router port forwarding to backend port
- Dynamic DNS or static IP
- HTTPS termination
- Backups for PostgreSQL volume

For real users, a VPS is simpler and safer.
For early private testing, home server plus Cloudflare Tunnel/Tailscale can work well.

Recommended later path:

1. Keep local Windows backend for development.
2. Use Tailscale or Cloudflare Tunnel for private iPhone/Mac testing.
3. Move PostgreSQL + API to VPS when external testers appear.
4. Move media from local disk to Cloudflare R2.

Detailed guide:

```text
docs/HOME_SERVER_DEPLOYMENT.md
```

## Current Verification State

The backend has been verified with:

```powershell
.\.tools\node\npm.cmd run typecheck
.\.tools\node\npm.cmd run build
.\.tools\node\npm.cmd test
.\.tools\node\npm.cmd run test:integration
.\.tools\node\npm.cmd audit --audit-level=moderate
```

Docker services were healthy:

```text
PostgreSQL: localhost:5432
Redis: localhost:6379
```
