import type { Href } from 'expo-router';
import { Image, type ImageSourcePropType, type View } from 'react-native';

import { push } from './nav';

// Where an article's cover was on screen when it was opened (window coordinates), so the reader can grow its cover
// out of that picture and shrink it back on close. `aspect` is the picture's width / height when known.
export type ArticleOrigin = { x: number; y: number; w: number; h: number; radius: number; aspect: number | null };

const origins = new Map<string, ArticleOrigin>();

export function articleOrigin(id: string): ArticleOrigin | null {
  return origins.get(id) ?? null;
}

function aspectOf(source: ImageSourcePropType | null | undefined) {
  if (typeof source !== 'number') return null;
  const s = Image.resolveAssetSource(source);
  return s?.width && s?.height ? s.width / s.height : null;
}

/** Measures the tapped cover, remembers it and opens the article (opens anyway if measuring fails). */
export function openArticle(id: string, cover: View | null, image: ImageSourcePropType | null | undefined, radius = 0) {
  const href = { pathname: '/article/[id]', params: { id } } as Href;
  if (!cover) return push(href);
  let opened = false;
  const go = () => {
    if (opened) return;
    opened = true;
    push(href);
  };
  cover.measureInWindow((x, y, w, h) => {
    if (w > 0 && h > 0) origins.set(id, { x, y, w, h, radius, aspect: aspectOf(image) });
    go();
  });
  setTimeout(go, 120);
}
