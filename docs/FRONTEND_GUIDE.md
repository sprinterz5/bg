# Puzzle iOS Frontend Guide

Этот файл описывает, как строить SwiftUI фронт поверх текущего backend.

## 1. Архитектура iOS

Стартовая схема:

- `AppState`: хранит auth-состояние, текущего пользователя, access token.
- `APIClient`: общий слой `URLSession + async/await`.
- `AuthService`: register/login/apple/refresh/logout.
- `BookService`: поиск и импорт книг.
- `ShelfService`: книжная полка.
- `ArticleService`: статьи, публикация, notes.
- `ReviewService`: рецензии.
- `FeedService`: For You / Following.
- `StoryService`: upload media, create story, friend stories, mark viewed.
- `ChatService`: REST для истории сообщений.
- `RealtimeService`: Socket.io client для live messages/typing/read.

MVVM:

- View отвечает только за отображение и действия пользователя.
- ViewModel вызывает сервисы и держит loading/error/state.
- Model повторяет JSON backend DTO, но не обязана полностью совпадать с Prisma.

## 2. Auth

Backend endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/apple`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`

Хранение токенов:

- `accessToken` держать в памяти и Keychain.
- `refreshToken` обязательно Keychain.
- На `401` делать `POST /auth/refresh`, обновлять оба токена, повторять исходный запрос один раз.

Sign in with Apple:

- iOS получает `identityToken`.
- Отправляет его в `POST /auth/apple`.
- Если пользователь новый, вместе с token можно отправить `username`, `displayName`, `interests`.

## 3. APIClient

Минимальная структура:

```swift
final class APIClient {
    let baseURL = URL(string: "http://localhost:4000")!
    var accessToken: String?

    func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: Encodable? = nil
    ) async throws -> T {
        // Build URLRequest
        // Add Authorization: Bearer accessToken
        // JSON encode body
        // Decode T
        // On 401 call refresh flow
    }
}
```

Для iOS simulator на Mac VM backend Windows-машины может быть доступен не как `localhost`, а как IP Windows host. Это лучше вынести в config.

## 4. Основные модели

Нужны Swift DTO:

- `UserDTO`
- `AuthResponse`
- `BookDTO`
- `ShelfItemDTO`
- `ArticleDTO`
- `ReviewDTO`
- `NoteDTO`
- `FeedItemDTO`
- `StoryDTO`
- `ConversationDTO`
- `MessageDTO`
- `ExploreItemDTO`

Enum names в backend уже uppercase:

- `READING`, `READ`, `WANT_TO_READ`
- `ARTICLE`, `REVIEW`
- `TEXT`, `SHARE_BOOK`, `SHARE_ARTICLE`, `SHARE_REVIEW`

В Swift можно декодировать как raw-value enums.

## 5. Экраны

Рекомендуемый порядок фронта:

1. Auth flow: login/register/Sign in with Apple.
2. Profile: текущий пользователь, интересы, полка.
3. Book search: `GET /books/search`, затем `POST /books/import`.
4. Shelf editor: `GET /me/shelves`, `PUT /me/shelves/:bookId`.
5. Article/review editor: draft -> publish.
6. Feed: segmented control `For You / Following`, filter `All / Articles / Books`.
7. Stories rail: `GET /stories/friends`.
8. Notes: выделение текста в статье и `POST /notes`.
9. Chats: conversations/messages + Socket.io.
10. Explore: `GET /explore`.

## 6. Feed

Endpoint:

`GET /feed?mode=for_you&filter=all&limit=20`

Modes:

- `for_you`: friends-first + interests + recency.
- `following`: only followed users, sorted by recency.

Filters:

- `all`
- `articles`
- `books` means book-related review content.

The response has:

- `data`
- `nextCursor` as ISO date string for `before`
- `algorithm`

Next page:

`GET /feed?mode=for_you&filter=all&before=<nextCursor>`

## 7. Stories

Upload image:

`POST /media` multipart with field `kind=STORY_IMAGE`.

Create story:

`POST /stories`

```json
{
  "bookId": "uuid",
  "mediaUrl": "http://localhost:4000/media/story_image/...",
  "mediaMimeType": "image/jpeg",
  "caption": "optional"
}
```

Friend stories:

`GET /stories/friends`

Important behavior:

- Before viewing: `book = null`, `caption = null`, `ringState = "unseen"`.
- After `POST /stories/:id/view`: backend returns book details and `ringState = "seen"`.

So UI should show an unread ring without revealing the book title until the story is viewed.

## 8. Notes

When user selects text inside an article/review:

`POST /notes`

```json
{
  "targetType": "ARTICLE",
  "targetId": "uuid",
  "selectedText": "highlighted text",
  "noteText": "user note",
  "anchorStart": 120,
  "anchorEnd": 180
}
```

Saved notes:

`GET /me/notes`

In SwiftUI article reader, keep selection metadata locally and send `anchorStart/anchorEnd` when possible.

## 9. Chats

REST:

- `GET /conversations`
- `POST /conversations/direct`
- `GET /conversations/:id/messages`
- `POST /conversations/:id/messages`
- `POST /conversations/:id/read`

Share a book:

```json
{
  "type": "SHARE_BOOK",
  "sharedBookId": "uuid"
}
```

Share an article:

```json
{
  "type": "SHARE_ARTICLE",
  "sharedArticleId": "uuid"
}
```

Realtime:

- Connect Socket.io with `auth.token = accessToken`.
- Listen for `message:new`.
- Emit `typing` with `conversationId`.
- Backend auto-joins user rooms and conversation rooms.

## 10. Explore and Moderation

User-facing:

`GET /explore?filter=all`

Only approved content appears here.

Moderator/admin-only:

- `GET /moderation/queue`
- `POST /moderation/ARTICLE/:id/approve`
- `POST /moderation/ARTICLE/:id/reject`
- `POST /moderation/REVIEW/:id/approve`
- `POST /moderation/REVIEW/:id/reject`

For MVP iOS app, moderator UI can be a hidden/debug screen or a simple internal web/admin client.

## 11. Local Development Notes

When Xcode runs in macOS VM and backend runs on Windows:

- Put Windows host IP into iOS config, not `localhost`.
- Allow backend port `4000` through Windows firewall if needed.
- Keep Google Books API key in backend `.env`, not in iOS app.
- For media URLs, backend returns absolute `PUBLIC_MEDIA_URL`; set it to a URL reachable from the VM.
