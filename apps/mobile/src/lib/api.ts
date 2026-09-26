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
let refreshing: Promise<boolean> | null = null;

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

type ApiInit = { method?: string; body?: unknown; form?: FormData; auth?: boolean };

async function send<T>(path: string, init: ApiInit): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  // Multipart: fetch sets the Content-Type with the boundary itself.
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? (init.body === undefined && !init.form ? 'GET' : 'POST'),
    headers,
    body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** Rotates the stored refresh token. Returns the /auth/refresh body, or null when the session is gone. */
export async function refreshSession<T>(): Promise<(T & Tokens) | null> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;
  try {
    const data = await send<T & Tokens>('/auth/refresh', { body: { refreshToken } });
    await saveTokens(data);
    return data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) await clearTokens();
    return null;
  }
}

/** JSON request; authed requests retry once after refreshing an expired access token. */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  try {
    return await send<T>(path, init);
  } catch (e) {
    if (!(init.auth && e instanceof ApiError && e.status === 401)) throw e;
    refreshing ??= refreshSession().then((d) => !!d).finally(() => (refreshing = null));
    if (!(await refreshing)) throw e;
    return send<T>(path, init);
  }
}

export const getAccessToken = () => accessToken;
