import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { ApiArticleCreated } from '@api/api';

import { api, ApiError } from '@/lib/api';
import { CAPTURE, captureParam } from '@/lib/capture';
import { fetchArticle, fetchFeed, type FeedTab } from '@/lib/feed-api';
import { uploadImage } from '@/lib/media';
import { reportError } from '@/lib/report-errors';
import { useSession } from '@/state/session';
import { ARTICLES, FEED, HOME_STORIES, MOCK_THOUGHTS, type Article, type Author, type Post, type Story } from '@/mock/data';
import { fetchFriendStories, viewStory } from '@/lib/stories';
import type { Picture } from '@/lib/picture';

/** How long the "Posted" card stays before folding away. */
const POSTED_MS = 1600;

export type ArticleDraft = {
  coverUri: string | null;
  body: string;
  label: string;
  /** "Subtitle..." on the New Article step; shown on the reader's preview. */
  subtitle: string;
};

/** The post being sent, shown in the card over the tab bar: uploading the cover, sending the text, "Posted" (with the
 *  new article's id, tap opens it), or failed (Retry / ✕). `done`: the card is folding away. */
export type Publishing = {
  /** null: a thought (no picture). */
  cover: Picture | null;
  title: string;
  subtitle?: string;
  stage: 'upload' | 'post' | 'posted' | 'error';
  articleId?: string;
  done?: boolean;
};

/** Longest thought (title 80 + subtitle 240 on the server). */
export const THOUGHT_MAX = 320;

type FeedContextValue = {
  posts: Post[];
  articles: Record<string, Article>;
  draft: ArticleDraft;
  updateDraft: (patch: Partial<ArticleDraft>) => void;
  publishing: Publishing | null;
  publish: (author: Author) => void;
  /** A "thought": a short text post without a picture; goes up like a post (the "Posting..." card). */
  publishThought: (text: string, author: Author) => void;
  /** After an error: send again (same request id, so a post that did reach the server isn't doubled). */
  retryPublish: () => void;
  /** After an error: drop the card and put the post back into the composer. */
  cancelPublish: () => void;
  /** Next page of the server's feed (?capture: more mock posts, the same ones under new ids). */
  loadMore: () => void;
  /** Stories row: the followed users' stories from the server, then the mock ones. */
  stories: Story[];
  /** The viewer opened a server story: marks it watched on the server and gives its caption (kept by the viewer, so
   *  the stories row under it doesn't re-render while it's open). */
  openedStory: (id: string) => Promise<string | null>;
  /** The Home tab whose posts are shown; switching loads its first page. */
  tab: FeedTab;
  setTab: (tab: FeedTab) => void;
  /** The server answered for the current tab (an empty tab can say so). */
  loadedTab: boolean;
  /** Pull-to-refresh: the server's first page again (and the stories). */
  refresh: () => Promise<void>;
  /** Loads a post's text into `articles` when it isn't there (posts from the server, profiles). */
  ensureArticle: (id: string) => Promise<boolean>;
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

const emptyDraft: ArticleDraft = { coverUri: null, body: '', label: '', subtitle: '' };

const FeedContext = createContext<FeedContextValue | null>(null);
// Separate from the feed so marking stories watched re-renders only the stories row, not the whole Home list.
const SeenContext = createContext<SeenContextValue | null>(null);

export function FeedProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  // The user's own just-published posts (local, until the server's page has them); mock posts only in ?capture.
  const [posts, setPosts] = useState<Post[]>(CAPTURE ? FEED : []);
  const [server, setServer] = useState<Post[]>([]);
  const [serverStories, setServerStories] = useState<Story[]>([]);
  const [tab, setTabState] = useState<FeedTab>('For you');
  const [loadedTab, setLoadedTab] = useState(false);
  const tabRef = useRef<FeedTab>('For you');
  const cursor = useRef<{ next: string | null; loading: boolean; done: boolean }>({ next: null, loading: false, done: true });
  const [articles, setArticles] = useState<Record<string, Article>>(ARTICLES);
  const [draft, setDraft] = useState<ArticleDraft>(emptyDraft);
  // ?capture&posting=upload|post|posted|error shows the card in that state (design checks).
  const [publishing, setPublishing] = useState<Publishing | null>(() => {
    const stage = CAPTURE ? captureParam('posting') : null;
    return stage ? { cover: FEED[0].image!, title: FEED[0].title, stage: stage as Publishing['stage'], articleId: FEED[0].articleId } : null;
  });
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

  // The post in flight: what to send, and the request id that makes retries safe.
  const job = useRef<{ draft: ArticleDraft; author: Author; key: string; coverUrl?: string; thought?: string } | null>(null);

  const run = useCallback(async () => {
    const j = job.current;
    if (!j) return;
    const d = j.draft;
    const title = d.label.trim().slice(0, 80);
    const subtitle = d.subtitle.trim().slice(0, 240) || undefined;
    const paragraphs = d.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (j.thought !== undefined) {
      // A thought goes the same way as a post, without the picture: the card says "Posting...", then the post comes
      // up on top of the feed.
      const text = j.thought;
      try {
        setPublishing((v) => v && { ...v, stage: 'post' });
        let id = `a_${Date.now()}`;
        if (CAPTURE) await new Promise((r) => setTimeout(r, 900));
        else {
          const created = await api<ApiArticleCreated>('/articles', {
            body: { title: text.slice(0, 80), ...(text.length > 80 ? { subtitle: text.slice(80) } : {}), body: text, publish: true },
            auth: true,
            idempotent: true,
            idempotencyKey: j.key,
          });
          id = created.id;
        }
        const author = j.author;
        setPosts((p) => [{ id: `p_${id}`, author, image: null, title: text, caption: '', timeAgo: 'just now', likes: 0, comments: 0, shares: 0, articleId: id }, ...p]);
        job.current = null;
        setPublishing((v) => v && { ...v, stage: 'posted', articleId: id });
        setTimeout(() => {
          setPublishing((v) => v && v.articleId === id ? { ...v, done: true } : v);
          setTimeout(() => setPublishing((v) => (v?.articleId === id ? null : v)), 450);
        }, POSTED_MS);
      } catch (e) {
        reportError(new Error(`thought failed: ${e instanceof Error ? e.message : String(e)} ${e instanceof ApiError ? JSON.stringify(e.body).slice(0, 300) : ''}`), { level: 'warn' });
        setPublishing((v) => v && { ...v, stage: 'error' });
      }
      return;
    }
    try {
      setPublishing((v) => v && { ...v, stage: 'upload' });
      let id: string;
      if (CAPTURE) {
        await new Promise((r) => setTimeout(r, 1200));
        setPublishing((v) => v && { ...v, stage: 'post' });
        await new Promise((r) => setTimeout(r, 800));
        id = `a_${Date.now()}`;
      } else {
        j.coverUrl ??= (await uploadImage(d.coverUri!, 'ARTICLE_COVER')).url;
        setPublishing((v) => v && { ...v, stage: 'post' });
        const created = await api<ApiArticleCreated>('/articles', {
          body: { title, ...(subtitle ? { subtitle } : {}), body: paragraphs.join('\n\n') || title, coverImageUrl: j.coverUrl, publish: true },
          auth: true,
          idempotent: true,
          idempotencyKey: j.key,
        });
        id = created.id;
      }
      // The feed itself is still mock: the post goes on top of it locally (the picture from the phone, no download).
      const cover = { uri: d.coverUri! };
      const author = j.author;
      setArticles((a) => ({ ...a, [id]: { id, author, cover, title, subtitle, body: paragraphs.length ? paragraphs : [title], likes: 0, comments: 0, shares: 0 } }));
      setPosts((p) => [{ id: `p_${id}`, author, image: cover, title, caption: subtitle ?? '', timeAgo: 'just now', likes: 0, comments: 0, shares: 0, articleId: id }, ...p]);
      job.current = null;
      setPublishing((v) => v && { ...v, stage: 'posted', articleId: id });
      setTimeout(() => {
        setPublishing((v) => v && v.articleId === id ? { ...v, done: true } : v);
        setTimeout(() => setPublishing((v) => (v?.articleId === id ? null : v)), 450);
      }, POSTED_MS);
    } catch (e) {
      // the step it failed on goes to the server log (POST /client-logs) with the error
      reportError(new Error(`publish failed (${j.coverUrl ? 'post' : 'upload'}): ${e instanceof Error ? e.message : String(e)} ${e instanceof ApiError ? JSON.stringify(e.body).slice(0, 300) : ''}`), { level: 'warn' });
      setPublishing((v) => v && { ...v, stage: 'error' });
    }
  }, []);

  const publish = useCallback((author: Author) => {
    const d = draftRef.current;
    if (!d.coverUri || !d.label.trim() || job.current) return;
    job.current = { draft: d, author, key: `post-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    setPublishing({ cover: { uri: d.coverUri }, title: d.label.trim(), subtitle: d.subtitle.trim() || undefined, stage: 'upload' });
    setDraft(emptyDraft);
    run();
  }, [run]);

  // The text goes up as title (first 80 characters) + subtitle (the rest, up to 240) + body (all of it); a post
  // without a cover is what the feed shows as a thought. Starts at once (the composer closes), like a post.
  const publishThought = useCallback((text: string, author: Author) => {
    const t = text.trim().slice(0, THOUGHT_MAX);
    if (!t || job.current) return;
    job.current = { draft: emptyDraft, author, key: `thought-${Date.now()}-${Math.random().toString(36).slice(2)}`, thought: t };
    setPublishing({ cover: null, title: t, stage: 'post' });
    run();
  }, [run]);

  const retryPublish = useCallback(() => {
    if (job.current) run();
  }, [run]);

  const cancelPublish = useCallback(() => {
    const j = job.current;
    job.current = null;
    if (j && j.thought === undefined) setDraft(j.draft);
    setPublishing(null);
  }, []);

  const hidePost = useCallback((id: string) => {
    setPosts((p) => p.filter((post) => post.id !== id));
    setServer((p) => p.filter((post) => post.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    if (CAPTURE || !user) return;
    const c = cursor.current;
    c.loading = true;
    fetchFriendStories().then(setServerStories, () => {});
    const t = tabRef.current;
    try {
      const page = await fetchFeed(null, t);
      if (tabRef.current !== t) return; // switched again meanwhile
      setServer(page.posts);
      setLoadedTab(true);
      cursor.current = { next: page.nextCursor, loading: false, done: !page.nextCursor };
    } catch {
      c.loading = false;
    }
  }, [user]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const loadMore = useCallback(() => {
    const c = cursor.current;
    if (!c.done) {
      if (c.loading) return;
      c.loading = true;
      const t = tabRef.current;
      fetchFeed(c.next, t)
        .then((page) => {
          if (tabRef.current !== t) return;
          setServer((s) => [...s, ...page.posts.filter((p) => !s.some((x) => x.id === p.id))]);
          cursor.current = { next: page.nextCursor, loading: false, done: !page.nextCursor };
        })
        .catch(() => (c.loading = false));
      return;
    }
    if (CAPTURE) setPosts((p) => (p.length >= MOCK_MAX ? p : [...p, ...mockPage(p.length)]));
  }, []);

  const articlesRef = useRef(articles);
  const serverRef = useRef(server);
  useEffect(() => {
    articlesRef.current = articles;
    serverRef.current = server;
  }, [articles, server]);
  const ensureArticle = useCallback(async (id: string) => {
    if (articlesRef.current[id]) return true;
    try {
      const a = await fetchArticle(id);
      // the article endpoint has no counters: the feed card's (comments, shares) go to the reader's bar
      const card = serverRef.current.find((p) => p.articleId === id);
      setArticles((m) => ({ ...m, [id]: card ? { ...a, likes: card.likes, comments: card.comments, shares: card.shares } : a }));
      return true;
    } catch {
      return false;
    }
  }, []);

  // Only "For you" keeps what it has loaded: coming back shows it at once, so the list can be put back where it was.
  // The other tabs load again each time (pull to refresh reloads any of them).
  const forYou = useRef<{ server: Post[]; next: string | null; done: boolean } | null>(null);
  const setTab = useCallback(
    (t: FeedTab) => {
      if (t === tabRef.current) return;
      const c = cursor.current;
      if (tabRef.current === 'For you') forYou.current = { server: serverRef.current, next: c.next, done: c.done };
      tabRef.current = t;
      setTabState(t);
      if (t === 'For you' && forYou.current) {
        const cached = forYou.current;
        setServer(cached.server);
        setLoadedTab(true);
        cursor.current = { next: cached.next, loading: false, done: cached.done };
        return;
      }
      setServer([]);
      setLoadedTab(false);
      cursor.current = { next: null, loading: false, done: true };
      refresh();
    },
    [refresh],
  );

  const stories = useMemo(() => [...(user ? serverStories : []), ...HOME_STORIES], [serverStories, user]);
  const openedStory = useCallback((id: string) => viewStory(id).then((v) => v.caption, () => null), []);

  // The user's own new posts (not yet in a server page) on top, then the server's, then the mock feed.
  const merged = useMemo(() => {
    const fromServer = new Set(server.map((p) => p.articleId));
    // after signing out the previous account's server posts are left out (the next sign-in refreshes them)
    // own new posts show on "For you" only (they carry no topic, and you don't follow yourself)
    const mine = tab === 'For you' ? posts.filter((p) => p.id.startsWith('p_') && !fromServer.has(p.articleId)) : [];
    const rest = posts.filter((p) => !p.id.startsWith('p_'));
    const base = [...mine, ...(user ? server : []), ...rest];
    if (tab !== 'For you' || (!user && !CAPTURE)) return base;
    // mock thoughts among the posts: the first one on top (as in the design), then every third place
    const out = [...base];
    MOCK_THOUGHTS.forEach((t, i) => out.splice(Math.min(out.length, i * 3), 0, t));
    return out;
  }, [posts, server, user, tab]);

  const value = useMemo(
    () => ({ posts: merged, tab, setTab, loadedTab, stories, openedStory, articles, draft, updateDraft, publishing, publish, publishThought, retryPublish, cancelPublish, loadMore, refresh, ensureArticle, hidePost }),
    [merged, tab, setTab, loadedTab, stories, openedStory, articles, draft, updateDraft, publishing, publish, publishThought, retryPublish, cancelPublish, loadMore, refresh, ensureArticle, hidePost],
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
