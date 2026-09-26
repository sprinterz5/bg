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
// THIS.svg Explore (text styles from the export): 227 media, chip 292x52 (white 1px stroke included)
// at 4 / 5.5 from the bottom, Sen 800 18.4/20 +0.1% with baselines at chip top +23.7 / +43.7;
// caption SF 14/16 +0.25% (lead 590) at x 11.5, 12 under the media; meta 11.5 at x 12.5, 5 below; next card 23 below.
  card: { paddingBottom: 23 },
  media: { height: 227, backgroundColor: colors.surfaceSoft, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  titleChip: {
    position: 'absolute',
    left: 4,
    bottom: 5.5,
    width: 292,
    height: 52,
    paddingTop: 6.5, // Sen baseline = (20 − 1.203·18.4)/2 + 0.9395·18.4 = 16.2 into the line
    paddingHorizontal: 6,
    borderRadius: 13.5,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  titleText: { fontFamily: fonts.display, fontSize: 18.4, lineHeight: 20, letterSpacing: 18.4 * 0.001, color: colors.text },
  captionBlock: { paddingHorizontal: 11.5, marginTop: 12, gap: 5 },
  caption: { fontSize: 14, lineHeight: 16, letterSpacing: 14 * 0.0025, color: colors.text },
  lead: { fontWeight: '600' },
  time: { fontSize: 11.5, lineHeight: 16, marginLeft: 1, color: colors.textSubtle },
});
