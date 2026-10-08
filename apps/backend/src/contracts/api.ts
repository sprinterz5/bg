// JSON shapes of the endpoints the mobile app reads, shared by both apps.
// The mobile imports this file as types only (`import type … from '@api/contracts'`, path alias in
// apps/mobile/tsconfig.json), so nothing from here ends up in the app bundle. Routes return their bodies through
// `asApi<T>()`: dropping or renaming a field the app relies on fails the backend typecheck. Routes may send more
// fields than listed; only what the app reads belongs here.

export type Page<T> = { data: T[]; nextCursor: string | null };

export type ApiUserSummary = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/** Signed-in user (auth responses, PATCH /users/me). */
export type ApiSessionUser = ApiUserSummary & { interests: string[] };

export type ApiTokens = { accessToken: string; refreshToken: string };

/** POST /auth/register, /auth/login, /auth/refresh. */
export type ApiAuthResponse = ApiTokens & { user: ApiSessionUser };

/** POST /auth/google, /auth/apple (and their signup completion). */
export type ApiSocialResponse = ({ signupRequired: false } & ApiAuthResponse) | { signupRequired: true; email: string | null };

/** GET /auth/username-availability. */
export type ApiUsernameAvailability = { available: boolean };

/** GET /users/:username. */
export type ApiProfile = ApiUserSummary & {
  bio: string | null;
  isFollowing: boolean;
  isMe: boolean;
  _count: { followers: number; following: number; authoredArticles: number };
};

/** GET /users/:username/articles (page). */
export type ApiUserArticle = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
  likeCount: number;
};

/** GET /users/:username/followers | following (page). */
export type ApiConnection = ApiUserSummary & { isFollowing: boolean; isMe: boolean };

/** GET /search?type=users. */
export type ApiUserSearch = { data: { users: ApiUserSummary[] } };

export type ApiChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: string;
};

export type ApiConversationMember = { userId: string; lastReadAt: string | null; user: ApiUserSummary };

/** POST /conversations/direct: no messages. */
export type ApiConversationBase = { id: string; updatedAt: string; members: ApiConversationMember[] };

/** GET /conversations: with the latest message. */
export type ApiConversation = ApiConversationBase & { messages: ApiChatMessage[] };

/** POST /media. */
export type ApiMediaAsset = { id: string; url: string; width: number | null; height: number | null };

/** A body as a route builds it: Date where the JSON has an ISO string (Fastify serializes Dates). */
export type ApiInput<T> = T extends string
  ? T | Date
  : T extends readonly (infer U)[]
    ? readonly ApiInput<U>[]
    : T extends object
      ? { [K in keyof T]: ApiInput<T[K]> }
      : T;

/** Checks a response body against its contract at compile time; returns it unchanged. */
export function asApi<T>(value: ApiInput<T>): T {
  return value as T;
}
