import type { SessionUser } from '@/state/session';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const TAKEN_USERNAMES = new Set(['steve_jobsie', 'bookgram', 'admin', 'sam_altman', 'j_nori_k']);

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

export function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
}

export async function checkUsernameAvailable(username: string) {
  await wait(350);
  return !TAKEN_USERNAMES.has(username);
}

export async function socialSignIn(_provider: 'google' | 'apple') {
  await wait(600);
  return { isNewUser: true };
}

export async function loginWithUsername(username: string, password: string): Promise<SessionUser | null> {
  await wait(500);
  if (!USERNAME_PATTERN.test(username) || password.length < 6) return null;
  return { id: `u_${username}`, name: username, username, avatarUri: null, interests: [] };
}

export async function completeSignup(user: Omit<SessionUser, 'id'>): Promise<SessionUser> {
  await wait(400);
  return { id: `u_${user.username}`, ...user };
}
