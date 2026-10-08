import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ARTICLES, displayName, type ExplorePost } from '@/mock/data';
import { colors } from '@/theme';
import { openArticle } from '@/lib/article-origin';
import { AuthorAvatar } from './author-row';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { INTER_FAMILIES, Text } from './text';

const GRAY = '#6B6B6B';

function formatCount(n: number) {
  return n >= 1000 ? `${Math.round(n / 100) / 10}K`.replace('.0K', 'K') : String(n);
}

// Frame 1198 Explore / search results row (offsets from the avatar top): author line, title (Inter ExtraBold
// 19.75/26, up to 3 lines) +36.4 with a 91x59 picture on the right at +35, excerpt (Inter 13.75/18.5, 2 lines)
// 11 under the title, counters 26.8 under the excerpt, a hairline 36.2 under them; the next avatar 31 below it.
export const ExploreRow = memo(function ExploreRow({ post }: { post: ExplorePost }) {
  const article = ARTICLES[post.articleId];
  const author = article?.author;
  const [saved, setSaved] = useState(false);
  // The reader grows its cover out of the picture.
  const thumb = useRef<View>(null);
  const open = () => openArticle(post.articleId, thumb.current, post.image, 2);
  const toggleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaved((v) => !v);
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={post.title}>
        <View style={styles.head}>
          {author ? <AuthorAvatar author={author} size={19.5} /> : <View style={styles.avatarStub} />}
          <Text style={styles.meta} numberOfLines={1}>
            <Text style={styles.author}>{author ? (author.name ?? displayName(author.username)) : ''}</Text>
            {` ·  ${post.timeAgo}`}
          </Text>
        </View>
        <Text style={styles.title} numberOfLines={3}>
          {post.title}
        </Text>
        <Text style={styles.excerpt} numberOfLines={2}>
          {post.lead}
          {post.rest}
        </Text>
        <View ref={thumb} collapsable={false} style={styles.thumb}>
          <Image source={post.image} recyclingKey={post.id} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        </View>
      </Pressable>

      <View style={styles.counters}>
        <Icon name="rowLike" width={13.5} height={12.12} style={styles.like} />
        <Text style={[styles.count, styles.likeCount]}>{formatCount(article?.likes ?? 0)}</Text>
        <Icon name="rowShare" width={14.72} height={13.5} style={styles.share} />
        <Text style={[styles.count, styles.shareCount]}>{formatCount(article?.shares ?? 0)}</Text>
        <PressableScale onPress={toggleSave} hitSlop={10} accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark'} style={styles.bookmark}>
          <Icon name="rowBookmark" width={16.7} height={16.7} tintColor={saved ? colors.primary : undefined} />
        </PressableScale>
        <PressableScale hitSlop={12} accessibilityLabel="More" style={styles.more}>
          <Icon name="rowMore" width={17.3} height={3.34} />
        </PressableScale>
      </View>
      <View style={styles.hairline} />
    </View>
  );
});

const styles = StyleSheet.create({
  row: { paddingTop: 31 },
  // avatar 19.5 at x 22; "Bill Gates · 2d ago" (Inter 11.75, -0.5%) from x 49.6, its line 1.6 under the avatar top
  head: { height: 19.5, flexDirection: 'row', paddingLeft: 22 },
  avatarStub: { width: 19.5, height: 19.5, borderRadius: 9.75, backgroundColor: colors.surfaceSoft },
  meta: { marginLeft: 8.1, marginTop: 1.6, fontFamily: INTER_FAMILIES['400'], fontSize: 11.75, lineHeight: 14.2, letterSpacing: 11.75 * -0.005, color: GRAY },
  author: { color: colors.text },
  title: { marginTop: 16.9, marginLeft: 22, width: 238, fontFamily: INTER_FAMILIES['800'], fontSize: 19.75, lineHeight: 26, letterSpacing: 19.75 * -0.0125, color: colors.text },
  excerpt: { marginTop: 11.1, marginLeft: 22.5, width: 238, fontFamily: INTER_FAMILIES['400'], fontSize: 13.75, lineHeight: 18.5, letterSpacing: 13.75 * 0.015, color: GRAY },
  thumb: { position: 'absolute', left: 276.5, top: 35, width: 91, height: 59, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.surfaceSoft },
  // counters (Inter Medium 11.25/16): heart at x 26.8, "520" at x 47.5, share at x 101.1, its count at x 123.9,
  // bookmark at x 300.9, ••• at x 343.8
  counters: { height: 16, marginTop: 26.8 },
  like: { position: 'absolute', left: 26.8, top: 2.2 },
  share: { position: 'absolute', left: 101.13, top: 2.3 },
  bookmark: { position: 'absolute', left: 300.85, top: 1.1 },
  more: { position: 'absolute', left: 343.8, top: 8.8 },
  count: { position: 'absolute', top: 0, fontFamily: INTER_FAMILIES['500'], fontSize: 11.25, lineHeight: 16, color: GRAY },
  likeCount: { left: 47.5 },
  shareCount: { left: 123.9 },
  hairline: { marginTop: 36.2, marginLeft: 1, width: 389, height: 0.5, backgroundColor: '#E5E5E5' },
});
