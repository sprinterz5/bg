import Constants, { ExecutionEnvironment } from 'expo-constants';

import type { SessionUser, SignupDraft } from '@/state/session';
import { ApiError, api, clearTokens, getStoredRefreshToken, refreshSession, saveTokens } from './api';
import { uploadImage } from './media';

/** Expo Go has no Google Sign-In native module: requiring it there crashes the app at startup. */
export const googleSignInAvailable = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let google: GoogleModule | null = null;

function getGoogle(): GoogleModule {
  if (!googleSignInAvailable) throw new Error('Google sign-in works only in the Bookgram dev build, not in Expo Go');
  if (!google) {
    google = require('@react-native-google-signin/google-signin') as GoogleModule;
    // OAuth client ids are public. The ID token's audience is the web client; the backend accepts all three.
    google.GoogleSignin.configure({
      webClientId: '380177386353-ea8l9fgsp80j3lkg8gden0f2dchgci8s.apps.googleusercontent.com',
      iosClientId: '380177386353-prjvke8s4u7dtftpsv8d9h2v2jcaj318.apps.googleusercontent.com',
    });
  }
  return google;
}

// Same rule as the backend (usernameService): a–z, 0–9, _ and . — no dot at either end, no double dots.
export const USERNAME_PATTERN = /^(?!\.)(?!.*\.\.)[a-z0-9_.]{3,30}(?<!\.)$/;

export function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
}

type ApiUser = { id: string; username: string; displayName: string | null; avatarUrl: string | null; interests: string[] };
type AuthResponse = { user: ApiUser; accessToken: string; refreshToken: string };
type SocialResponse = ({ signupRequired: false } & AuthResponse) | { signupRequired: true; email: string | null };

function toSessionUser(u: ApiUser): SessionUser {
  return { id: u.id, name: u.displayName ?? u.username, username: u.username, avatarUri: u.avatarUrl, interests: u.interests };
}

export type SocialResult = { kind: 'cancelled' } | { kind: 'signedIn'; user: SessionUser } | { kind: 'signup'; identityToken: string };

/** Provider sheet → backend. An existing account signs in; a new one gets the signup steps. */
export async function socialSignIn(provider: 'google' | 'apple'): Promise<SocialResult> {
  if (provider === 'apple') throw new Error('Sign in with Apple is not set up yet');

  const { GoogleSignin, isSuccessResponse } = getGoogle();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return { kind: 'cancelled' };
  const identityToken = res.data.idToken;
  if (!identityToken) throw new Error('Google returned no ID token');

  const data = await api<SocialResponse>('/auth/google', { body: { identityToken } });
  if (data.signupRequired) return { kind: 'signup', identityToken };
  await saveTokens(data);
  return { kind: 'signedIn', user: toSessionUser(data.user) };
}

/** Creates the account with the provider token kept from the first step. */
export async function completeSignup(draft: SignupDraft): Promise<SessionUser> {
  const data = await api<SocialResponse>(`/auth/${draft.provider}`, {
    body: {
      identityToken: draft.identityToken,
      username: draft.username,
      displayName: draft.name,
      password: draft.password || undefined,
      interests: draft.interests,
    },
  });
  if (data.signupRequired) throw new Error('Signup was not completed');
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

export async function loginWithUsername(username: string, password: string): Promise<SessionUser | null> {
  try {
    const data = await api<AuthResponse>('/auth/login', { body: { login: username, password } });
    await saveTokens(data);
    return toSessionUser(data.user);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export async function checkUsernameAvailable(username: string) {
  const data = await api<{ available: boolean }>(`/auth/username-availability?username=${encodeURIComponent(username)}`);
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
  if (googleSignInAvailable) await getGoogle().GoogleSignin.signOut().catch(() => {});
}
