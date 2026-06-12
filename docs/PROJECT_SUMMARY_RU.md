# Bookgram Backend Summary

Bookgram - backend для социальной сети вокруг книг, статей, рецензий, заметок, сторис, книжных полок и чатов.

Главная идея продукта: контент вокруг книг и идей, а не вокруг инфлюенсеров.

## Стек

- Node.js + TypeScript
- Fastify REST API
- Socket.io realtime
- PostgreSQL + Prisma
- Redis для кеша, rate limit, realtime/job locks
- Google Books API + Open Library fallback
- Local media storage, Cloudflare R2 и S3-compatible storage поддержаны через один media contract

## Что уже есть

### Auth

- Регистрация, логин, refresh token rotation, logout, logout all
- Mobile session management: список и удаление активных сессий
- Sign in with Apple endpoint
- Email verification через dev/log transport
- Password reset через dev/log transport
- JWT bearer auth для iOS

### Social Graph

- Профили пользователей
- Follow / unfollow
- Block / mute
- Роли: `USER`, `MODERATOR`, `ADMIN`
- Block/mute учитываются в ленте, сторис и чатах

### Books / Shelves

- Поиск книг через Google Books API
- Open Library fallback
- Импорт книги в локальную базу
- Книжная полка: `READING`, `READ`, `WANT_TO_READ`
- Прогресс чтения, рейтинг, приватная заметка
- Similar books graph

### Articles / Reviews / Notes

- Создание, редактирование, публикация статей
- Рецензии привязаны к книге
- Модерация перед публичным показом
- Notes внутри статей/рецензий через selected text + anchor offsets
- Черновики, archive/soft delete

### Home / Feed

- `GET /home` для первого экрана приложения
- `GET /feed` с режимами `for_you` и `following`
- Фильтры `all`, `articles`, `books`
- Feed cards включают `media`, `viewer`, `counts`
- Поведенческие события через `POST /feed/events`
- Redis cache для ленты

### Stories / Reading Now

- `GET /reading-now/me`
- `GET /reading-now/friends`
- `GET /stories/book-candidates?q=`
- Story creation с привязкой к книге
- До просмотра book/caption скрыты
- После просмотра book/caption раскрываются
- Если story создана с `bookId`, книга попадает в shelf как `READING`

### Chats / Share

- Direct conversations
- Messages
- Share book/article/review
- `POST /share`
- Socket.io события: `conversation:created`, `message:new`, `conversation:read`, `typing`, `notification:new`
- Block-aware access
- Redis rate limit на сообщения

### Search / Explore

- `GET /search` по users/books/articles/reviews
- PostgreSQL `pg_trgm` и GIN indexes
- Explore показывает только approved content
- Explore ранжируется по интересам, свежести, quality/trending score, spam penalty и diversity

### Safety / Moderation

- Reports на users/articles/reviews/stories/messages/notes/comments
- Moderator queue
- Approve/reject article/review
- Resolve/dismiss reports
- Anti-spam scoring job
- Notifications авторам и репортерам

### Notifications / Push Foundation

- REST notifications
- Unread count
- Mark read / read all
- Socket.io `notification:new`
- Device tokens под APNs
- Реального APNs sender пока нет, потому что нужны Apple Developer данные

### Media

- `POST /media` multipart upload
- JPEG/PNG/WebP only
- MIME sniffing по байтам
- Re-encode в WebP
- Metadata stripping
- Thumbnail variants
- Local provider сейчас
- R2/S3 adapter уже заложен и может отдавать `/media/...` через backend proxy для раннего тестирования
- `POST /media/upload-url` уже зарезервирован под будущий direct upload; при local storage возвращает fallback на multipart
- Media moderation foundation:
  - статус `PENDING | APPROVED | FLAGGED | REJECTED`
  - провайдер `DISABLED | LOCAL_STUB | OPENAI | GOOGLE_VISION | AWS_REKOGNITION | HIVE`
  - event log `MediaModerationEvent`
  - moderation queue
  - ручное approve/flag/reject
  - async scan job

### Reliability / Ops

- Endpoint-specific Redis rate limits
- `Idempotency-Key` для мобильных retry на важных write endpoints
- `ContentCounter` для быстрых счетчиков feed cards
- Request timing logs и slow request warnings
- `JobRun` history
- Cleanup job:
  - expired idempotency keys
  - old finished job runs
- Hot indexes под feed/search/media moderation queues
- Admin endpoints:
  - `GET /admin`
  - `GET /admin/stats`
  - `GET /admin/users`
  - `GET /admin/content-scores`
  - `GET /admin/job-runs`
  - `PATCH /admin/users/:id/role`

### AI / ML Preparation

- `AiEmbedding` table для будущих embeddings
- Provider abstraction:
  - `DISABLED`
  - `LOCAL_HASH`
  - `OPENAI_COMPATIBLE`
- `LOCAL_HASH` нужен для бесплатной проверки pipeline без настоящего ИИ
- Embedding backfill job:
  - `ai-embedding-backfill`
  - `npm run jobs:ai-embeddings`
- Admin endpoints:
  - `GET /ai/readiness`
  - `GET /ai/embeddings`
  - `POST /ai/jobs/embeddings`
- Background runner умеет запускать AI embedding job по расписанию
- Документация:
  - `docs/AI_DEPLOYMENT_PREP.md`

## Использованные алгоритмы

Это не ML-модели. Сейчас это объяснимые heuristic/ranking algorithms, которые можно дебажить и постепенно заменять ML/embeddings.

### `behavioral_ranking_v2`

For You feed. Учитывает follows, interests, tags, book categories, свежесть, qualityScore, trendingScore, spamScore, block/mute и прошлые interactions.

### `cold_start_v1`

Первая лента для новых пользователей, когда мало feed events/follows/shelves. Опирается на onboarding interests, tags, categories и свежесть.

### `following_recency_v1`

Following feed. Простая хронология по авторам, на которых подписан пользователь, с учетом block/mute.

### `moderated_quality_trending_diversity_v1`

Explore. Только approved content, плюс manual score, interests, freshness, quality/trending, spam penalty и легкий diversity penalty по авторам.

### `trigram_text_relevance_quality_v2`

Search. Использует pg_trgm candidates, exact/prefix/contains match, authors/categories/tags, quality/trending и spam penalty.

### ContentScore

Агрегирует impressions, opens, completions, dwell time, likes, saves, hides, shares, comments, reports. Выводит qualityScore, engagementScore, trendingScore, spamScore.

### ContentCounter

Нормализованные быстрые счетчики для UI: likes, comments, bookmarks, shares, reports, views. Feed сначала читает их, потом fallback на ContentScore.

### Book Similarity

Похожие книги считаются по shared authors, categories, language, publisher, shared shelf users и shared review users.

### Story Ordering

Поднимает unseen stories, mutual follows, shared books и свежие сторис. Blocked/muted users скрываются.

### Anti-Spam Scoring

Считает риск по unverified email, new account, short/low-effort body, link density, duplicate tags/title, repeated chars, post velocity, open reports, hide/report rates. Не удаляет автоматически, а возвращает подозрительный content в moderation.

## Что еще не сделано

- Реальный APNs sender
- Реальный SMTP/Resend/SendGrid provider
- R2 presigned direct upload
- Semantic search/reranking поверх embeddings
- Deep ML recommendations, vector search
- Полные OpenAPI schemas на каждом route
- Production CI/CD pipeline
- Большой web admin UI вместо простого internal dashboard
- Segment notes/progress strip для reading progress: продуктово отложено

## Главные файлы

- `src/app.ts` - сборка Fastify приложения
- `src/server.ts` - запуск сервера
- `prisma/schema.prisma` - база данных
- `src/routes/*` - REST API
- `src/services/*` - бизнес-логика
- `src/jobs/*` - фоновые jobs
- `docs/MAC_SWIFTUI_AGENT_HANDOFF.md` - файл для SwiftUI агента на Mac
- `docs/HOME_SERVER_DEPLOYMENT.md` - запуск дома
- `docs/PRODUCTION_DEPLOYMENT.md` - production notes
- `docs/openapi.json` - OpenAPI export
- `docs/IMPLEMENTATION_LOG.md` - лог работ

## Проверки

Последний прогон:

```powershell
.\.tools\node\npm.cmd run typecheck
.\.tools\node\npm.cmd run build
.\.tools\node\npm.cmd run test:all
.\.tools\node\npm.cmd run docs:openapi
```
