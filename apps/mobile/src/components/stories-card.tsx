import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View, type NativeSyntheticEvent, type TextLayoutEventData } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import type { Story } from '@/mock/data';
import { colors } from '@/theme';
import { AuthorRow } from './author-row';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from '@/components/text';

// Figma section 7, home 3307:xxxx (x 0): stories are swiped, no arrows. Offsets are from the avatar top:
// square media at +43 on #ECECEC, caption (2 lines, "...more") on the left, white like/comment pill
// 87x37 at media bottom +7 and 7 from the right, time under the caption.
type Props = { stories: Story[] };

export function StoriesCard({ stories }: Props) {
  const { width } = useWindowDimensions();
  return (
    <FlatList
      data={stories}
      keyExtractor={(s) => s.id}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      renderItem={({ item }) => <StoryPage story={item} width={width} />}
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
    />
  );
}

function StoryPage({ story, width }: { story: Story; width: number }) {
  return (
    <View style={{ width }}>
      <AuthorRow author={story.author} />
      <View style={[styles.media, { height: width }]}>
        <Image source={story.image} style={styles.image} contentFit="contain" transition={200} />
      </View>
      <View style={styles.below}>
        <View style={styles.captionBlock}>
          <Caption text={story.caption} />
          <Text style={styles.time}>{story.timeAgo}</Text>
        </View>
        <Reactions />
      </View>
    </View>
  );
}

/** Two lines at most; a cut caption ends with "...more" like in the design. */
function Caption({ text }: { text: string }) {
  const [cut, setCut] = useState<string | null>(null);
  const onLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    const lines = e.nativeEvent.lines;
    if (cut !== null || lines.length <= 2) return;
    // Room for "...more" at the end of the second line.
    const two = lines[0].text + lines[1].text;
    setCut(two.slice(0, Math.max(0, two.length - 10)).trimEnd());
  };

  if (cut !== null) {
    return (
      <Text style={styles.caption} numberOfLines={2}>
        {cut}...<Text style={styles.more}>more</Text>
      </Text>
    );
  }
  return (
    <Text style={styles.caption} onTextLayout={onLayout}>
      {text}
    </Text>
  );
}

function Reactions() {
  const [liked, setLiked] = useState(false);
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked((v) => !v);
    pop.value = withSequence(withSpring(1.25, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 10, stiffness: 300 }));
  };

  return (
    <View style={styles.pill}>
      <PressableScale onPress={toggle} hitSlop={8} scaleTo={0.9} accessibilityLabel={liked ? 'Unlike' : 'Like'} style={styles.like}>
        <Animated.View collapsable={false} style={popStyle}>
          <Icon name={liked ? 'storyLikeFilled' : 'storyLike'} width={26.8} height={23.8} />
        </Animated.View>
      </PressableScale>
      <PressableScale hitSlop={8} scaleTo={0.9} accessibilityLabel="Comments" style={styles.comment}>
        <Icon name="storyComment" width={24.75} height={24.05} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  media: { marginTop: 11, backgroundColor: '#ECECEC' },
  image: { width: '100%', height: '100%' },
  below: { flexDirection: 'row', justifyContent: 'space-between' },
  // caption glyphs start at x 11.13, 14.9 below the media
  captionBlock: { flex: 1, paddingLeft: 11, paddingRight: 10, paddingTop: 12 },
  caption: { fontSize: 13, lineHeight: 16, color: colors.text },
  more: { color: colors.textSubtle },
  time: { marginTop: 13.9, fontSize: 12, lineHeight: 16, color: colors.textSubtle },
  pill: { width: 87, height: 37, marginTop: 7, marginRight: 7, borderRadius: 18.5, backgroundColor: '#FFFFFF' },
  // heart 26.8x23.8 at (13.1, 6.88), comment 24.75x24.05 at (50.1, 6.6) inside the pill
  like: { position: 'absolute', left: 13.1, top: 6.88 },
  comment: { position: 'absolute', left: 50.1, top: 6.6 },
});
