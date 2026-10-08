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
  /** Next page of the feed (mock: the same posts again under new ids, so long scrolling can be tested). */
  loadMore: () => void;
  /** "Not interested": drops the post from the feed. */
  hidePost: (id: string) => void;
};

type SeenContextValue = {
  /** Stories opened in the viewer this session (grey ring on Home). */
  seenStories: ReadonlySet<string>;
  markStoriesSeen: (ids: string[]) => void;
};

const MOCK_PAGE = 10;
const MOCK_MAX = 3000;

function mockPage(from: number): Post[] {
  return Array.from({ length: MOCK_PAGE }, (_, i) => {
    const src = FEED[(from + i) % FEED.length];
    return { ...src, id: `${src.id}~${from + i}` };
  });
}

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
  const markStoriesSeen = useCallback(
    (ids: string[]) => setSeenStories((s) => (ids.every((id) => s.has(id)) ? s : new Set([...s, ...ids]))),
    [],
  );
  const seen = useMemo(() => ({ seenStories, markStoriesSeen }), [seenStories, markStoriesSeen]);
  // Latest draft for publish() without re-creating it on every keystroke.
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

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

  const hidePost = useCallback((id: string) => setPosts((p) => p.filter((post) => post.id !== id)), []);
  const loadMore = useCallback(() => setPosts((p) => (p.length >= MOCK_MAX ? p : [...p, ...mockPage(p.length)])), []);

  const value = useMemo(
    () => ({ posts, articles, draft, updateDraft, publishing, publish, loadMore, hidePost }),
    [posts, articles, draft, updateDraft, publishing, publish, loadMore, hidePost],
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
