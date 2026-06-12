# Bookgram AI Deployment Prep

Этот файл описывает, что уже подготовлено для будущего ИИ-слоя и как его включать без переделки всего backend.

## Что подготовлено

### 1. Provider abstraction

Файл:

```text
src/services/aiProviderService.ts
```

Режимы:

```text
DISABLED
LOCAL_HASH
OPENAI_COMPATIBLE
```

`LOCAL_HASH` - бесплатный deterministic dev/test provider. Это не настоящий ML, а стабильная заглушка, чтобы проверить pipeline, job history, БД и API без ключей.

`OPENAI_COMPATIBLE` - HTTP embeddings endpoint с форматом `/embeddings`. Его можно направить на OpenAI-compatible API или свой gateway.

### 2. Embedding storage

Таблица:

```text
AiEmbedding
```

Хранит:

- target type: `ARTICLE | REVIEW | BOOK`
- target id
- provider
- model
- dimensions
- input hash
- vector JSON
- text preview
- status: `PENDING | READY | FAILED`
- error
- embeddedAt

Почему vector пока JSON:

- не нужно менять Docker Postgres на pgvector image прямо сейчас;
- миграция уже безопасна для локального dev;
- позже можно добавить `pgvector` или отдельный vector DB и мигрировать данные без изменения route/job API.

### 3. Embedding backfill job

Файл:

```text
src/services/aiEmbeddingService.ts
```

Job:

```text
ai-embedding-backfill
```

Что делает:

- берет approved published articles/reviews и books;
- строит embedding input text;
- считает input hash;
- пропускает unchanged content;
- генерирует embedding через provider;
- пишет `AiEmbedding`;
- ошибки пишет в row и `JobRun`.

Запуск вручную:

```powershell
.\.tools\node\npm.cmd run jobs:ai-embeddings
```

Или через API:

```http
POST /ai/jobs/embeddings
```

### 4. Admin/ops endpoints

```text
GET /ai/readiness
GET /ai/embeddings
POST /ai/jobs/embeddings
```

Auth: moderator/admin.

### 5. Background runner

Если включить:

```text
JOB_RUNNER_ENABLED=true
```

то `ai-embedding-backfill` может запускаться по расписанию. При `AI_ENABLED=false` job безопасно завершится со skipped result.

## Env

Для выключенного режима:

```text
AI_ENABLED=false
AI_PROVIDER=DISABLED
```

Для локальной проверки pipeline без настоящего ИИ:

```text
AI_ENABLED=true
AI_PROVIDER=LOCAL_HASH
AI_EMBEDDING_MODEL=bookgram-local-hash-embedding-v1
AI_EMBEDDING_DIMENSIONS=256
```

Для реального OpenAI-compatible embeddings endpoint:

```text
AI_ENABLED=true
AI_PROVIDER=OPENAI_COMPATIBLE
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=...
AI_EMBEDDING_MODEL=...
AI_EMBEDDING_DIMENSIONS=...
```

Job schedule:

```text
JOB_AI_EMBEDDINGS_INTERVAL_MINUTES=120
JOB_AI_EMBEDDINGS_LIMIT=50
```

## Что делать перед настоящим AI deploy

1. Выбрать embeddings provider.
2. Поставить `AI_PROVIDER=OPENAI_COMPATIBLE`.
3. Добавить ключ в env/secrets, не в git.
4. Проверить:

```http
GET /ai/readiness
```

5. Запустить маленький backfill:

```http
POST /ai/jobs/embeddings

{
  "limit": 10,
  "targetTypes": ["ARTICLE", "REVIEW", "BOOK"]
}
```

6. Проверить:

```http
GET /ai/embeddings?status=READY
GET /admin/job-runs?name=ai-embedding-backfill
```

7. Только после этого включать background runner.

## Что можно построить поверх этого дальше

### Semantic search

Сначала можно делать candidate generation через Postgres trigram, потом rerank по cosine similarity из `AiEmbedding`.

### Similar content

Похожие статьи/рецензии/книги по embedding similarity.

### Feed reranker

Текущий feed ranking оставляем как candidate generator, а AI reranker переставляет top N.

### AI moderation

Отдельный classifier позже может писать сигналы в moderation pipeline, но автоматическое удаление делать не надо. Лучше сначала только `PENDING`/review.

## Что пока не сделано специально

- Нет pgvector extension.
- Нет отдельной vector database.
- Нет ML reranker.
- Нет semantic search route.
- Нет AI moderation classifier.

Это не забыто. Это следующий слой после накопления данных и выбора провайдера.
