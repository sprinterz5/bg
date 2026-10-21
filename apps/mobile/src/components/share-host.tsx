import { useSyncExternalStore } from 'react';

import { CommentsSheet } from '@/components/comments-sheet';
import { ShareSheet } from '@/components/share-sheet';

// The send-to-people and comments sheets for posts in lists (a feed card can't hold a full-screen sheet): one host
// over the tabs, opened with openShare() / openComments(). The reader keeps its own (it's a separate modal on iOS).
type Target = { id: string; title: string; comments?: boolean };
let current: Target | null = null;
const listeners = new Set<() => void>();
const set = (t: Target | null) => {
  current = t;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const openShare = (t: Target) => set(t);
export const openComments = (articleId: string) => set({ id: articleId, title: '', comments: true });

export function ShareHost() {
  const target = useSyncExternalStore(subscribe, () => current);
  if (!target) return null;
  return target.comments ? (
    <CommentsSheet key={`c${target.id}`} articleId={target.id} onClose={() => set(null)} />
  ) : (
    <ShareSheet key={target.id} article={target} onClose={() => set(null)} />
  );
}
