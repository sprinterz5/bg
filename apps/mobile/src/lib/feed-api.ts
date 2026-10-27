import type { ApiArticle, ApiFeedItem, ApiFeedPage } from '@api/api';

import type { Article, Author, Post } from '@/mock/data';
import { api } from './api';

const authorOf = (u: ApiFeedItem['author']): Author => ({
  username: u.username,
  name: u.displayName ?? undefined,
  avatar: u.avatarUrl ? { uri: u.avatarUrl } : null,
  subtitle: '',
});

/** "now", "5m", "7h", "3d", "2w" — the feed card's short form. */
export function shortAgo(iso: string | null) {
  if (!iso) return '';
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d` : `${Math.floor(d / 7)}w`;
}

function toPost(i: ApiFeedItem): Post | null {
  if (i.targetType !== 'ARTICLE' || !i.coverImageUrl) return null;
  return {
    id: `s_${i.targetId}`,
    author: authorOf(i.author),
    image: { uri: i.coverImageUrl },
    title: i.title,
    caption: i.subtitle ?? '',
    timeAgo: shortAgo(i.publishedAt),
    likes: i.counts.likes,
    liked: i.viewer.liked,
    saved: i.viewer.bookmarked,
    comments: i.counts.comments,
    shares: i.counts.shares,
    views: i.counts.views || undefined,
    articleId: i.targetId,
  };
}

export type FeedTab = 'For you' | 'Following' | 'Saved' | 'History';

/** One page of a Home tab (articles with a cover only: the card needs a picture). "For you" is ranked (cursor);
 *  "Following" (people you follow) is newest first, "Saved" (own bookmarks) by bookmark time and "History" (posts
 *  opened) by last open; those three page with `before`. */
export async function fetchFeed(cursor?: string | null, tab: FeedTab = 'For you') {
  const mode = `mode=${tab === 'For you' ? 'for_you' : tab.toLowerCase()}`;
  const next = cursor ? `&${tab === 'For you' ? 'cursor' : 'before'}=${encodeURIComponent(cursor)}` : '';
  const q = `/feed?${mode}&filter=articles&limit=20${next}`;
  const page = await api<ApiFeedPage>(q, { auth: true });
  return { posts: page.data.map(toPost).filter((p): p is Post => !!p), nextCursor: page.nextCursor };
}

/** A post's full text for the reader (posts from the server aren't in the local article map). */
export async function fetchArticle(id: string): Promise<Article> {
  const a = await api<ApiArticle>(`/articles/${encodeURIComponent(id)}`, { auth: true });
  const body = a.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return {
    id: a.id,
    author: authorOf(a.author),
    cover: a.coverImageUrl ? { uri: a.coverImageUrl } : null!,
    title: a.title,
    subtitle: a.subtitle ?? undefined,
    body: body.length ? body : [a.title],
    likes: 0,
    comments: 0,
    shares: 0,
  };
}
