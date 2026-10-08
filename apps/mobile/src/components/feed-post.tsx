import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useRef, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import type { Post } from '@/mock/data';
import { colors, fonts } from '@/theme';
import { AuthorAvatar } from './author-row';
import { Icon } from './icon';
import { PostActions } from './post-actions';
import { PressableScale } from './pressable-scale';
import { INTER_FAMILIES, Text } from '@/components/text';
import { openArticle as openArticleFrom } from '@/lib/article-origin';
import { openProfile } from '@/lib/nav';

const EXCERPT = '#6B6B6B';

function formatCount(n: number) {
  return n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n);
}

// Frame 1198 home card. Offsets from the avatar top (design y 242.5): photo 265 tall at +39, title (2 lines of
// 27) 17.5 under the photo, excerpt 10 under the title, counters 23 under the excerpt, time 17 under them, the next
// card's avatar ~25 below.
export const FeedPost = memo(function FeedPost({ post, onHide }: { post: Post; onHide: (id: string) => void }) {
  const [saved, setSaved] = useState(false);
  const [menu, setMenu] = useState(false);
  // The reader grows its cover out of this photo.
  const media = useRef<View>(null);
  const openArticle = () => openArticleFrom(post.articleId, media.current, post.image);
  const toggleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaved((v) => !v);
  };

  return (
    <View>
      <View style={styles.head}>
        <Pressable onPress={() => openProfile(post.author.username)} hitSlop={6} accessibilityRole="link" accessibilityLabel={`${post.author.username} profile`} style={styles.author}>
          <AuthorAvatar author={post.author} size={31} />
          <View style={styles.names}>
            <Text style={styles.name} numberOfLines={1}>
              {post.author.username}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              Recommended for you
            </Text>
          </View>
        </Pressable>
        <PressableScale onPress={() => setMenu(true)} hitSlop={12} accessibilityLabel="More" style={styles.menu}>
          <Icon name="postMenu" width={20} height={10.5} />
        </PressableScale>
      </View>

      <PressableScale onPress={openArticle} accessibilityRole="button" accessibilityLabel={post.title} style={styles.media}>
        <View ref={media} collapsable={false} style={StyleSheet.absoluteFill}>
          <Image source={post.image} recyclingKey={post.id} style={styles.image} contentFit="cover" transition={200} />
        </View>
      </PressableScale>

      <Pressable onPress={openArticle} accessibilityRole="button">
        <Text style={styles.title} numberOfLines={2}>
          {post.title}
        </Text>
        <Text style={styles.excerpt} numberOfLines={2}>
          {post.caption}
        </Text>
      </Pressable>

      <View style={styles.actions}>
        <Icon name="postViews" width={25.06} height={18} style={styles.views} />
        <Text style={[styles.count, styles.viewsCount]}>{formatCount(post.views ?? post.likes)}</Text>
        <PressableScale hitSlop={8} accessibilityLabel="Share" style={styles.send}>
          <Icon name="postSend" width={18.03} height={17.58} />
        </PressableScale>
        <Text style={[styles.count, styles.sendCount]}>{formatCount(post.shares)}</Text>
        <PressableScale onPress={toggleSave} hitSlop={10} accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark'} style={styles.bookmark}>
          <Icon name="postBookmark2" width={17.75} height={19.76} tintColor={saved ? colors.primary : undefined} />
        </PressableScale>
      </View>

      <Text style={styles.time}>{post.timeAgo}</Text>

      <PostActions
        visible={menu}
        onClose={() => setMenu(false)}
        actions={[
          { label: saved ? 'Remove from saved' : 'Save', onPress: () => setSaved((v) => !v) },
          { label: 'Share', onPress: () => Share.share({ message: post.title }).catch(() => {}) },
          { label: 'Not interested', onPress: () => onHide(post.id) },
          { label: 'Report', destructive: true, onPress: () => Alert.alert('Thanks for letting us know', 'We will look at this post.') },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  // avatar 31 at x 11; username (Inter SemiBold 12.6) at x 52 from +0.5, "Recommended for you" (Inter 11) from +16.5;
  // menu (two bars, 20x10.5) at x 358, +9.5
  head: { height: 31, flexDirection: 'row', paddingLeft: 10 },
  author: { flexDirection: 'row', maxWidth: 300 },
  names: { marginLeft: 10, marginTop: 0.5 },
  name: { fontFamily: INTER_FAMILIES['600'], fontSize: 13.6, lineHeight: 16.5, letterSpacing: 13.6 * 0.035, color: colors.text },
  sub: { marginTop: 0.75, fontFamily: INTER_FAMILIES['400'], fontSize: 11.5, lineHeight: 14, letterSpacing: 11.5 * 0.02, color: colors.text },
  menu: { position: 'absolute', left: 358, top: 9.5 },
  media: { height: 265, marginTop: 7, backgroundColor: colors.surfaceSoft, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  // Sentinel Bold 20/27 in the design; Source Serif 4 Bold in the app (see fonts.headline).
  title: { marginTop: 18.5, marginLeft: 13.5, width: 306, fontFamily: fonts.headline, fontSize: 21.25, lineHeight: 26.5, letterSpacing: 21.25 * -0.014, color: colors.text },
  excerpt: { marginTop: 10, marginLeft: 15.5, width: 330, fontFamily: INTER_FAMILIES['400'], fontSize: 14.15, lineHeight: 19.4, letterSpacing: 14.15 * 0.005, color: EXCERPT },
  // counters (SF Pro Semibold 13/16) 23 under the excerpt: eye 25x18 at x 16.85, "520" at x 50, send at x 106.65,
  // its count at x 133, bookmark at x 363.3
  actions: { height: 16, marginTop: 18 },
  views: { position: 'absolute', left: 16.85, top: -0.75 },
  send: { position: 'absolute', left: 106.65, top: 0.3 },
  bookmark: { position: 'absolute', left: 363.27, top: -1.38 },
  count: { position: 'absolute', top: 0, fontSize: 13.8, lineHeight: 17, fontWeight: '600', color: colors.text },
  viewsCount: { left: 50 },
  sendCount: { left: 133 },
  time: { marginTop: 13, marginLeft: 17.5, fontFamily: INTER_FAMILIES['400'], fontSize: 11.5, lineHeight: 16, color: '#788690' },
});
