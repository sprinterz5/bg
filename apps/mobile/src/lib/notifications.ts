import type { ApiNotification, Page } from '@api/api';

import type { Notice } from '@/mock/data';
import { api } from './api';

export type NoticeSection = { title: string; items: Notice[]; muted?: boolean };

// The kinds the list shows (messages have the chats; story views and moderation aren't shown here).
const WHAT: Record<string, (n: ApiNotification) => string> = {
  FOLLOW: () => 'started following you',
  LIKE: () => 'liked your post',
  COMMENT: () => 'commented on your post',
  COMMENT_REPLY: () => 'replied to your comment',
  BOOKMARK: () => 'saved your post',
};

const DAY = 24 * 60 * 60 * 1000;

/** Newest first, in "Today" / "This week" / "Earlier". */
export async function fetchNotices(): Promise<NoticeSection[]> {
  const page = await api<Page<ApiNotification>>('/notifications?limit=60', { auth: true });
  const sections: NoticeSection[] = [
    { title: 'Today', items: [] },
    { title: 'This week', items: [] },
    { title: 'Earlier', items: [] },
  ];
  const now = Date.now();
  for (const n of page.data) {
    const what = WHAT[n.type];
    if (!what || !n.actor) continue;
    const age = now - new Date(n.createdAt).getTime();
    const notice: Notice = {
      id: n.id,
      avatars: n.actor.avatarUrl ? [{ uri: n.actor.avatarUrl }] : [require('@/assets/icons/avatar-placeholder.png')],
      who: n.actor.username,
      what: what(n),
      username: n.actor.username,
      userId: n.actor.id,
      articleId: n.article?.id,
      thumb: n.article?.coverImageUrl ? { uri: n.article.coverImageUrl } : undefined,
      follow: n.type === 'FOLLOW' ? n.actorFollowed : undefined,
      unread: !n.readAt,
    };
    sections[age < DAY ? 0 : age < 7 * DAY ? 1 : 2].items.push(notice);
  }
  return sections.filter((s) => s.items.length);
}

export const markAllRead = () => api('/notifications/read-all', { method: 'POST', auth: true }).catch(() => {});

export const unreadCount = () => api<{ count: number }>('/notifications/unread-count', { auth: true }).then((r) => r.count);
