import type { ApiChatMessage, ApiFriendStory, ApiViewedStory } from '@api/api';

import type { Story } from '@/mock/data';
import { api } from './api';
import { openDirect } from './chat';
import { shortAgo } from './feed-api';

/** Active stories of the people the user follows, unseen first. */
export async function fetchFriendStories(): Promise<Story[]> {
  const list = await api<ApiFriendStory[]>('/stories/friends', { auth: true });
  return list.map((s) => ({
    id: s.id,
    author: { username: s.user.username, name: s.user.displayName ?? undefined, avatar: s.user.avatarUrl ? { uri: s.user.avatarUrl } : null, subtitle: '' },
    image: { uri: s.mediaUrl },
    caption: s.caption ?? '',
    timeAgo: shortAgo(s.createdAt) === 'now' ? 'just now' : `${shortAgo(s.createdAt)} ago`,
    seen: s.viewed,
    authorId: s.user.id,
    remote: true,
  }));
}

/** Marks the story watched; returns its caption. */
export const viewStory = (id: string) => api<ApiViewedStory>(`/stories/${id}/view`, { method: 'POST', auth: true });

/** A reply goes to the author's direct chat, linked to the story. */
export async function replyToStory(story: Story, text: string) {
  if (!story.authorId) throw new Error('not a server story');
  const chat = await openDirect(story.authorId);
  return api<ApiChatMessage>(`/conversations/${chat.id}/messages`, {
    body: { type: 'TEXT', body: text, replyToStoryId: story.id },
    auth: true,
    idempotent: true,
  });
}
