import { useCallback, useSyncExternalStore } from 'react';

import { api } from './api';

// Like / bookmark of a post, shared by its feed card and the reader. Posts from the server (uuid ids) send the wanted
// state 400ms after the last tap (a double tap is one request or none); on failure the state goes back.
export type Reaction = { liked: boolean; saved: boolean; likes: number };

const store = new Map<string, Reaction>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const isServer = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);

/** First data wins: the feed seeds what the server said; later seeds don't undo a tap. */
export function seedReaction(id: string, r: Reaction) {
  if (!store.has(id)) store.set(id, r);
}

const set = (id: string, r: Reaction) => {
  store.set(id, r);
  emit();
};

const timers = new Map<string, ReturnType<typeof setTimeout>>();
// What the server has, per post and kind, to know what to undo when a request fails.
const confirmed = new Map<string, boolean>();

function sync(id: string, kind: 'like' | 'save', want: boolean, undo: () => void) {
  if (!isServer(id)) return;
  const key = `${kind}:${id}`;
  if (!confirmed.has(key)) confirmed.set(key, !want);
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      if (confirmed.get(key) === want) return;
      const req =
        kind === 'like'
          ? api('/likes/toggle', { body: { targetType: 'ARTICLE', targetId: id, liked: want }, auth: true })
          : api('/bookmarks/toggle', { body: { targetType: 'ARTICLE', targetId: id, bookmarked: want }, auth: true });
      req.then(() => confirmed.set(key, want), undo);
    }, 400),
  );
}

export function useReaction(id: string, fallback: Reaction) {
  // the first card / reader to show the post seeds it (the snapshot must be the same object between calls)
  if (!store.has(id)) store.set(id, fallback);
  const r = useSyncExternalStore(subscribe, () => store.get(id)!);
  const toggleLike = useCallback(() => {
    const cur = store.get(id) ?? fallback;
    const next = { ...cur, liked: !cur.liked, likes: Math.max(0, cur.likes + (cur.liked ? -1 : 1)) };
    set(id, next);
    sync(id, 'like', next.liked, () => {
      const now = store.get(id) ?? next;
      if (now.liked === next.liked) set(id, { ...now, liked: !next.liked, likes: Math.max(0, now.likes + (next.liked ? -1 : 1)) });
    });
  }, [id, fallback]);
  const toggleSave = useCallback(() => {
    const cur = store.get(id) ?? fallback;
    const next = { ...cur, saved: !cur.saved };
    set(id, next);
    sync(id, 'save', next.saved, () => {
      const now = store.get(id) ?? next;
      if (now.saved === next.saved) set(id, { ...now, saved: !next.saved });
    });
  }, [id, fallback]);
  return { ...r, toggleLike, toggleSave };
}
