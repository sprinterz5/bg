import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import type { ExplorePost } from '@/mock/data';
import { colors, fonts } from '@/theme';
import { PressableScale } from './pressable-scale';
import { push } from '@/lib/nav';

// Figma 3163:1520 / 3170:2017: image 220 tall, title chip 8px from its bottom-left,
// caption 13/16 at x 15 with bold lead words, time 12/16 #788690, 24px to the next card.
export const ExploreCard = memo(function ExploreCard({ post }: { post: ExplorePost }) {
  const open = () => push({ pathname: '/article/[id]', params: { id: post.articleId } });

  return (
    <PressableScale scaleTo={0.985} onPress={open} accessibilityRole="button" accessibilityLabel={post.title} style={styles.card}>
      <View style={styles.media}>
        <Image source={post.image} style={styles.image} contentFit="cover" transition={200} />
        <View style={styles.titleChip}>
          <Text style={styles.titleText} numberOfLines={2}>
            {post.title}
          </Text>
        </View>
      </View>
      <View style={styles.captionBlock}>
        <Text style={styles.caption} numberOfLines={2}>
          <Text style={styles.lead}>{post.lead}</Text>
          {post.rest}
        </Text>
        <Text style={styles.time}>{post.reads ? `${post.reads} reads · ${post.timeAgo}` : post.timeAgo}</Text>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
// THIS.svg Explore: 227 media, chip 292x52 (white 1px stroke included) at 4 / 5.5 from the bottom,
// Sen 18.4/21 title; caption 13.15/16 (+0.25%) at x 11.5, 11.8 under the media; meta 5 below; next card 23.3 below.
  card: { paddingBottom: 23.3 },
  media: { height: 227, backgroundColor: colors.surfaceSoft, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  titleChip: {
    position: 'absolute',
    left: 4,
    bottom: 5.5,
    width: 292,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 13.5,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  titleText: { fontFamily: fonts.display, fontSize: 18.4, lineHeight: 21, color: colors.text },
  captionBlock: { paddingHorizontal: 11.5, marginTop: 11.8, gap: 5 },
  caption: { fontSize: 13.15, lineHeight: 16, letterSpacing: 13.15 * 0.0025, color: colors.text },
  lead: { fontWeight: '600' },
  time: { fontSize: 12, lineHeight: 16, color: colors.textSubtle },
});
