import { useSyncExternalStore } from 'react';

import { ShareSheet } from '@/components/share-sheet';

// The send-to-people sheet for posts in lists (a feed card can't hold a full-screen sheet): one host over the tabs,
// opened with openShare(). The reader keeps its own sheet (it's a separate modal on iOS).
type Target = { id: string; title: string };
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

export function ShareHost() {
  const target = useSyncExternalStore(subscribe, () => current);
  return target ? <ShareSheet key={target.id} article={target} onClose={() => set(null)} /> : null;
}
