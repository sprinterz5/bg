import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Post } from '@/mock/data';
import { colors, fonts } from '@/theme';
import { AuthorAvatar } from './author-row';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from '@/components/text';
import { push } from '@/lib/nav';

function formatCount(n: number) {
  return n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n);
}

// Frame 1049 home card. Offsets are from the avatar top (design y 242.25): photo 270 tall at +37.25,
// actions 11 under the photo, caption line 35.8 under it, time 3.2 under the caption, next post ~30 below.
export const FeedPost = memo(function FeedPost({ post }: { post: Post }) {
  const [saved, setSaved] = useState(false);
  const openArticle = () => push({ pathname: '/article/[id]', params: { id: post.articleId } });
  const toggleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaved((v) => !v);
  };

  return (
    <View>
      <View style={styles.head}>
        <AuthorAvatar author={post.author} size={30} />
        <View style={styles.names}>
          <Text style={styles.name} numberOfLines={1}>
            {post.author.username}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            Recommended for you
          </Text>
        </View>
        <PressableScale hitSlop={12} accessibilityLabel="More" style={styles.menu}>
          <Icon name="postMenu" width={20} height={13.75} />
        </PressableScale>
      </View>

      <PressableScale onPress={openArticle} accessibilityRole="button" accessibilityLabel={post.title} style={styles.media}>
        <Image source={post.image} style={styles.image} contentFit="cover" transition={200} />
        <View style={styles.chip}>
          <Text style={styles.title} numberOfLines={2}>
            {post.title}
          </Text>
        </View>
      </PressableScale>

      <View style={styles.actions}>
        <Icon name="postViews" width={22} height={16} style={styles.views} />
        <Text style={[styles.count, styles.viewsCount]}>{formatCount(post.views ?? post.likes)}</Text>
        <PressableScale hitSlop={8} accessibilityLabel="Share" style={styles.send}>
          <Icon name="postSend" width={16.96} height={16.54} />
        </PressableScale>
        <Text style={[styles.count, styles.sendCount]}>{formatCount(post.shares)}</Text>
        <PressableScale onPress={toggleSave} hitSlop={10} accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark'} style={styles.bookmark}>
          <Icon name="postBookmark2" width={17.75} height={18.75} tintColor={saved ? colors.primary : undefined} />
        </PressableScale>
      </View>

      <Text style={styles.caption} numberOfLines={2}>
        {post.caption}
      </Text>
      <Text style={styles.time}>{post.timeAgo}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  // avatar 30 at x 8; name baseline +12.1, "Recommended for you" baseline +26.4; menu (20x13.75) at x 356, +8.25
  head: { height: 30, flexDirection: 'row', paddingLeft: 8 },
  names: { marginLeft: 13.1, marginTop: -0.5, flex: 1 },
  name: { fontSize: 12.75, lineHeight: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 11, lineHeight: 13, marginTop: 0.5, color: colors.text },
  menu: { position: 'absolute', left: 356, top: 8.25 },
  media: { height: 270, marginTop: 7.25, backgroundColor: colors.surfaceSoft, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  // 285x50 rect with a centred 1px white stroke → 286x51 outside, 4 from the left, 6.75 from the bottom; 60% white
  chip: {
    position: 'absolute',
    left: 4,
    bottom: 6.75,
    width: 286,
    height: 51,
    paddingTop: 2.45,
    paddingLeft: 4.1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  // Sen measured against the frame: "Wiggling is welcome in this" is 276.8 wide → 20.4
  title: { width: 278, fontFamily: fonts.display, fontSize: 20.4, lineHeight: 21.5, color: colors.text },
  // eye 22x16 at x 11.25, count at x 42.9; send at x 87, count at x 113.8; bookmark at x 358.9 (all 11 under the photo)
  actions: { height: 19, marginTop: 11 },
  views: { position: 'absolute', left: 11.25, top: 0 },
  send: { position: 'absolute', left: 86.98, top: 0.23 },
  bookmark: { position: 'absolute', left: 358.875, top: -3.2 },
  count: { position: 'absolute', top: -0.8, fontSize: 12.6, lineHeight: 16, fontWeight: '600', color: colors.text },
  viewsCount: { left: 42.4 },
  sendCount: { left: 113.3 },
  caption: { marginTop: 5.8, paddingLeft: 11, paddingRight: 14, fontSize: 12.5, lineHeight: 15.4, color: colors.text },
  time: { marginTop: 3.2, paddingLeft: 12.4, fontSize: 11.5, lineHeight: 14, color: colors.textSubtle },
});
