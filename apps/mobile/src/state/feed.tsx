import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ARTICLES, FEED, type Article, type Author, type Post } from '@/mock/data';

export const PUBLISH_MS = 2600;

export type ArticleDraft = {
  coverUri: string | null;
  body: string;
  label: string;
};

type Publishing = { coverUri: string };

type FeedContextValue = {
  posts: Post[];
  articles: Record<string, Article>;
  draft: ArticleDraft;
  updateDraft: (patch: Partial<ArticleDraft>) => void;
  publishing: Publishing | null;
  publish: (author: Author) => void;
};

type SeenContextValue = {
  /** Stories opened in the viewer (grey ring on Home); kept across app restarts. */
  seenStories: ReadonlySet<string>;
  markStoriesSeen: (ids: string[]) => void;
};

// Watched story ids survive a restart (newest last, capped; a story lives a day, so old ids just age out).
const SEEN_KEY = 'seenStories';
const SEEN_MAX = 300;

const emptyDraft: ArticleDraft = { coverUri: null, body: '', label: '' };

const FeedContext = createContext<FeedContextValue | null>(null);
// Separate from the feed so marking stories watched re-renders only the stories row, not the whole Home list.
const SeenContext = createContext<SeenContextValue | null>(null);

export function FeedProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>(FEED);
  const [articles, setArticles] = useState<Record<string, Article>>(ARTICLES);
  const [draft, setDraft] = useState<ArticleDraft>(emptyDraft);
  const [publishing, setPublishing] = useState<Publishing | null>(null);
  const [seenStories, setSeenStories] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    SecureStore.getItemAsync(SEEN_KEY)
      .then((raw) => {
        const stored = raw ? (JSON.parse(raw) as string[]) : [];
        if (stored.length > 0) setSeenStories((s) => new Set([...stored, ...s]));
      })
      .catch(() => {});
  }, []);
  const markStoriesSeen = useCallback(
    (ids: string[]) =>
      setSeenStories((s) => {
        if (ids.every((id) => s.has(id))) return s;
        const next = new Set([...s, ...ids]);
        SecureStore.setItemAsync(SEEN_KEY, JSON.stringify([...next].slice(-SEEN_MAX))).catch(() => {});
        return next;
      }),
    [],
  );
  const seen = useMemo(() => ({ seenStories, markStoriesSeen }), [seenStories, markStoriesSeen]);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const updateDraft = useCallback((patch: Partial<ArticleDraft>) => setDraft((d) => ({ ...d, ...patch })), []);

  const publish = useCallback((author: Author) => {
    const d = draftRef.current;
    if (!d.coverUri || !d.label.trim()) return;
    const id = `a_${Date.now()}`;
    const cover = { uri: d.coverUri };
    const title = d.label.trim();
    const body = d.body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    setPublishing({ coverUri: d.coverUri });
    setDraft(emptyDraft);

    setTimeout(() => {
      setArticles((a) => ({
        ...a,
        [id]: { id, author, cover, title, body: body.length ? body : [title], likes: 0, comments: 0, shares: 0 },
      }));
      setPosts((p) => [
        { id: `p_${id}`, author, image: cover, title, caption: title, timeAgo: 'just now', likes: 0, comments: 0, shares: 0, articleId: id },
        ...p,
      ]);
      setPublishing(null);
    }, PUBLISH_MS);
  }, []);

  const value = useMemo(
    () => ({ posts, articles, draft, updateDraft, publishing, publish }),
    [posts, articles, draft, updateDraft, publishing, publish],
  );

  return (
    <FeedContext.Provider value={value}>
      <SeenContext.Provider value={seen}>{children}</SeenContext.Provider>
    </FeedContext.Provider>
  );
}

export function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeed must be used inside FeedProvider');
  return ctx;
}

export function useSeenStories() {
  const ctx = useContext(SeenContext);
  if (!ctx) throw new Error('useSeenStories must be used inside FeedProvider');
  return ctx;
}
