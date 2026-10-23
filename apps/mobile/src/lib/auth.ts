import type { ApiAuthResponse, ApiSessionUser, ApiUsernameAvailability } from '@api/api';

import type { SessionUser, SignupDraft } from '@/state/session';
import { ApiError, api, clearTokens, getStoredRefreshToken, refreshSession, saveTokens } from './api';
import { CAPTURE } from './capture';
import { uploadImage } from './media';
import { looksLikePhone, toE164 } from './phone';

// Same rule as the backend (usernameService): a–z, 0–9, _ and . — no dot at either end, no double dots.
export const USERNAME_PATTERN = /^(?!\.)(?!.*\.\.)[a-z0-9_.]{3,30}(?<!\.)$/;

export function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
}

type ApiUser = ApiSessionUser;
type AuthResponse = ApiAuthResponse;

function toSessionUser(u: ApiUser): SessionUser {
  return { id: u.id, name: u.displayName ?? u.username, username: u.username, avatarUri: u.avatarUrl, interests: u.interests };
}

// Same rule as the backend (passwordSchema): at least 6 characters, at least one letter.
export const isPasswordValid = (p: string) => p.length >= 6 && /\p{L}/u.test(p);

/** Creates the account (username + password, no email) and signs in. */
export async function completeSignup(draft: SignupDraft): Promise<SessionUser> {
  const data = await api<AuthResponse>('/auth/register', {
    body: {
      username: draft.username,
      displayName: draft.name,
      ...(draft.phone ? { phone: draft.phone } : {}),
      ...(draft.emailToken ? { emailToken: draft.emailToken } : {}),
      password: draft.password,
      interests: draft.interests,
      // The age step (13+) comes before this; the backend still wants the flag.
      ageConfirmed: true,
    },
  });
  await saveTokens(data);
  const user = toSessionUser(data.user);
  if (!draft.avatarUri) return user;
  // The account exists at this point: a failed avatar upload must not fail the signup,
  // the local picture is shown until it can be uploaded from the profile.
  try {
    return { ...user, avatarUri: await setAvatar(draft.avatarUri) };
  } catch {
    return { ...user, avatarUri: draft.avatarUri };
  }
}

/** Uploads a local picture and makes it the avatar. Returns its public URL. */
export async function setAvatar(localUri: string): Promise<string | null> {
  const asset = await uploadImage(localUri, 'AVATAR');
  const updated = await api<ApiUser>('/users/me', { method: 'PATCH', body: { avatarMediaId: asset.id }, auth: true });
  return updated.avatarUrl;
}

/** `login` is a username or a phone number (sent as E.164). */
export async function loginWithUsername(login: string, password: string): Promise<SessionUser | null> {
  try {
    const phone = looksLikePhone(login) ? toE164(login) : null;
    // an email is sent as typed (lowercased); a phone as E.164; anything else is a username
    const value = login.includes('@') ? login.trim().toLowerCase() : (phone ?? normalizeUsername(login));
    const data = await api<AuthResponse>('/auth/login', { body: { login: value, password } });
    await saveTokens(data);
    return toSessionUser(data.user);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

/** Sign-up: a code to the university address. 'recent': one went out less than a minute ago (still valid). */
export async function requestEmailCode(email: string): Promise<'sent' | 'recent' | 'taken' | 'domain' | 'failed'> {
  if (CAPTURE) return 'sent';
  try {
    await api('/auth/email-code', { body: { email } });
    return 'sent';
  } catch (e) {
    if (!(e instanceof ApiError)) return 'failed';
    if (e.status === 409) return 'taken';
    if (e.status === 400) return 'domain';
    if (e.status === 429) return 'recent';
    return 'failed';
  }
}

/** The code from the email → the token /auth/register wants, or null when it's wrong or expired. */
export async function verifyEmailCode(email: string, code: string): Promise<string | null> {
  if (CAPTURE) return 'capture';
  try {
    const r = await api<{ emailToken: string }>('/auth/email-code/verify', { body: { email, code } });
    return r.emailToken;
  } catch {
    return null;
  }
}

export async function checkPhoneAvailable(e164: string) {
  if (CAPTURE) return true;
  const data = await api<ApiUsernameAvailability>(`/auth/phone-availability?phone=${encodeURIComponent(e164)}`);
  return data.available;
}

export async function checkUsernameAvailable(username: string) {
  // design check (No Layout-1): "steve_jobsie" is the taken name
  if (CAPTURE) return username !== 'steve_jobsie';
  const data = await api<ApiUsernameAvailability>(`/auth/username-availability?username=${encodeURIComponent(username)}`);
  return data.available;
}

/** Session from the stored refresh token (app start). */
export async function restoreSession(): Promise<SessionUser | null> {
  const data = await refreshSession<{ user: ApiUser }>();
  return data ? toSessionUser(data.user) : null;
}

export async function logout() {
  const refreshToken = await getStoredRefreshToken();
  if (refreshToken) await api('/auth/logout', { body: { refreshToken } }).catch(() => {});
  await clearTokens();
}
