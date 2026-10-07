import * as SecureStore from 'expo-secure-store';

// Dev backend on the VPS. Override with EXPO_PUBLIC_API_URL (e.g. http://<PC LAN IP>:4000 for a local backend).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://31.220.92.154/api';

const REFRESH_KEY = 'bg.refreshToken';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}`);
  }
}

type Tokens = { accessToken: string; refreshToken: string };

let accessToken: string | null = null;
// One refresh at a time: the server rotates refresh tokens, so two parallel refreshes with the same token
// make the second one fail (401) and used to wipe the session.
let refreshing: Promise<unknown> | null = null;
let onExpired: (() => void) | null = null;

/** Called when the stored session can no longer be refreshed (the app should go back to sign-in). */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onExpired = handler;
}

export async function saveTokens(tokens: Tokens) {
  accessToken = tokens.accessToken;
  await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
}

export async function clearTokens() {
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export function getStoredRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

type ApiInit = {
  method?: string;
  body?: unknown;
  form?: FormData;
  auth?: boolean;
  /** Write the backend dedupes by Idempotency-Key: retried once with the same key when no response came back. */
  idempotent?: boolean;
  idempotencyKey?: string;
};

// Without a timeout a request on a dead connection hangs forever. Uploads get more time.
const TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;

async function send<T>(path: string, init: ApiInit): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  // Multipart: fetch sets the Content-Type with the boundary itself.
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.form ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.body === undefined && !init.form ? 'GET' : 'POST'),
      headers,
      body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
      signal: controller.signal,
    });
    text = await res.text();
  } catch (e) {
    // Status 0 = no HTTP response (timeout or network error).
    if (controller.signal.aborted) throw new ApiError(0, 'timeout');
    throw e;
  } finally {
    clearTimeout(timer);
  }

  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Not JSON (e.g. an HTML 502 page from the proxy): still an API error, not a crash in the caller.
      throw new ApiError(res.status, text);
    }
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** Rotates the stored refresh token (shared by concurrent callers). Returns the /auth/refresh body, or null when the session is gone. */
export function refreshSession<T>(): Promise<(T & Tokens) | null> {
  refreshing ??= doRefresh().finally(() => (refreshing = null));
  return refreshing as Promise<(T & Tokens) | null>;
}

async function doRefresh() {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;
  try {
    const data = await send<Tokens>('/auth/refresh', { body: { refreshToken } });
    await saveTokens(data);
    return data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      await clearTokens();
      onExpired?.();
    }
    return null;
  }
}

/** JSON request; authed requests retry once after refreshing an expired access token. */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  if (init.idempotent && !init.idempotencyKey) {
    init = { ...init, idempotencyKey: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}` };
  }
  try {
    return await send<T>(path, init);
  } catch (e) {
    // Timeout / dropped connection: the server may have done the write, the same key makes the retry safe.
    if (init.idempotent && (!(e instanceof ApiError) || e.status === 0)) return api<T>(path, { ...init, idempotent: false });
    if (!(init.auth && e instanceof ApiError && e.status === 401)) throw e;
    if (!(await refreshSession())) throw e;
    return send<T>(path, init);
  }
}

export const getAccessToken = () => accessToken;
