import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

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

const emptyDraft: ArticleDraft = { coverUri: null, body: '', label: '' };

const FeedContext = createContext<FeedContextValue | null>(null);

export function FeedProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>(FEED);
  const [articles, setArticles] = useState<Record<string, Article>>(ARTICLES);
  const [draft, setDraft] = useState<ArticleDraft>(emptyDraft);
  const [publishing, setPublishing] = useState<Publishing | null>(null);
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

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed() {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeed must be used inside FeedProvider');
  return ctx;
}
