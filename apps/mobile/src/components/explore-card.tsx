import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import type { ExplorePost } from '@/mock/data';
import { colors, fonts } from '@/theme';
import { PressableScale } from './pressable-scale';
import { push } from '@/lib/nav';

// Figma 3163:1520 / 3170:2017: image 220 tall, title chip 8px from its bottom-left,
// caption 13/16 at x 15 with bold lead words, time 12/16 #788690, 24px to the next card.
/** Hard caps (backend enforces the same). Whether a title fits the card's 2 lines is measured while typing:
 * see `exploreTitleStyle` and the new-article screen. */
export const ARTICLE_TITLE_MAX = 80;

export const ExploreCard = memo(function ExploreCard({ post }: { post: ExplorePost }) {
  const open = () => push({ pathname: '/article/[id]', params: { id: post.articleId } });

  return (
    <PressableScale scaleTo={0.985} onPress={open} accessibilityRole="button" accessibilityLabel={post.title} style={styles.card}>
      <View style={styles.media}>
        <Image source={post.image} style={styles.image} contentFit="cover" transition={200} />
        <View style={styles.titleChip}>
          {/* Figma: background blur 3 under the 80% white fill. iOS only — on Android every card in a scrolling
              list would need its own blur target, the white fill alone reads the same at this strength. */}
          {Platform.OS === 'ios' ? <BlurView intensity={9} tint="light" style={StyleSheet.absoluteFill} /> : null}
          <View style={[StyleSheet.absoluteFill, styles.titleFill]} />
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
// caption SF 14.075/16 +0.25% (lead 590) at x 11.5, 12 under the media; meta 12.15 at x 12.5, 5 below; next card 23 below.
  card: { paddingBottom: 40  }, // Figma gap between posts 16 (was 14 in THIS.svg → 23 here)
  media: { height: 227, backgroundColor: colors.surfaceSoft, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  titleChip: {
    position: 'absolute',
    left: 5.25,
    bottom: 6,
    // Frame 292x52 at a 19.4 title, scaled with the title (20.05 / 19.4), then −2 wide and −1 tall by eye.
    width: 299.8,
    height: 52.7,
    paddingTop: 8.25, // 2px lower than the frame, by eye on the phone
    paddingHorizontal: 6,
    borderRadius: 13.5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  titleFill: { backgroundColor: 'rgba(255,255,255,0.8)' },
  titleText: { width: 285.2, fontFamily: fonts.display, fontSize: 20.05, lineHeight: 20.67, letterSpacing: 20.05 * 0.01, color: colors.text },
  captionBlock: { paddingLeft: 13, paddingRight: 19, marginTop: 16, gap: 7 }, // text box 358 wide (x 11.5..369.5)
  caption: { fontSize: 14.25, lineHeight: 16, letterSpacing: 14.075 * 0.0025, color: colors.text },
  lead: { fontWeight: '600' },
  time: { fontSize: 12.35, lineHeight: 16, marginLeft: 1, color: colors.textSubtle },
});

/** The card title's exact text style (font, size, spacing, width): used to measure titles while typing. */
export const exploreTitleStyle = styles.titleText;
