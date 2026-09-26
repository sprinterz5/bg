import type { Profile } from '@/mock/data';
import { api, ApiError } from './api';

export type ApiProfile = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isFollowing: boolean;
  isMe: boolean;
  _count: { followers: number; following: number; authoredArticles: number };
};

export type ApiUserArticle = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
  likeCount: number;
};

export type ApiConnection = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isFollowing: boolean;
  isMe: boolean;
};

type Page<T> = { data: T[]; nextCursor: string | null };

const enc = encodeURIComponent;

export const fetchProfile = (username: string) => api<ApiProfile>(`/users/${enc(username)}`, { auth: true });

export const fetchUserArticles = (username: string) =>
  api<Page<ApiUserArticle>>(`/users/${enc(username)}/articles?limit=50`, { auth: true }).then((p) => p.data);

export const fetchConnections = (username: string, kind: 'followers' | 'following') =>
  api<Page<ApiConnection>>(`/users/${enc(username)}/${kind}?limit=100`, { auth: true }).then((p) => p.data);

export const setFollow = (userId: string, follow: boolean) =>
  api(`/users/${userId}/follow`, { method: follow ? 'POST' : 'DELETE', auth: true });

/** Design style: followers "1,5M" (comma), likes "1.2K" (dot). */
export function formatCount(n: number, sep: ',' | '.' = ',') {
  const short = (v: number, unit: string) => `${(Math.floor(v * 10) / 10).toString().replace('.', sep)}${unit}`;
  if (n >= 1_000_000) return short(n / 1_000_000, 'M');
  if (n >= 1_000) return short(n / 1_000, 'K');
  return String(n);
}

export function timeAgo(iso: string | null) {
  if (!iso) return '';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'} ago`;
  if (min < 60) return unit(min || 1, 'minute');
  const h = Math.round(min / 60);
  if (h < 24) return unit(h, 'hour');
  const d = Math.round(h / 24);
  if (d < 7) return unit(d, 'day');
  return unit(Math.round(d / 7), 'week');
}

/** API profile + its articles → the props the profile screens already render. */
export function toProfile(p: ApiProfile, articles: ApiUserArticle[]): Profile {
  return {
    username: p.username,
    name: p.displayName ?? p.username,
    avatar: p.avatarUrl ? { uri: p.avatarUrl } : null,
    articles: p._count.authoredArticles,
    followers: formatCount(p._count.followers),
    following: p._count.following,
    bio: p.bio ? p.bio.split('\n').filter(Boolean) : [],
    posts: articles.map((a) => ({
      id: a.id,
      image: a.coverImageUrl ? { uri: a.coverImageUrl } : null,
      title: a.title,
      likes: formatCount(a.likeCount, '.'),
      timeAgo: timeAgo(a.publishedAt),
      articleId: a.id,
    })),
  };
}

/** Profile + articles in one go; null when the user does not exist on the backend. */
export async function loadProfile(username: string) {
  try {
    const [p, articles] = await Promise.all([fetchProfile(username), fetchUserArticles(username)]);
    return { api: p, profile: toProfile(p, articles) };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
