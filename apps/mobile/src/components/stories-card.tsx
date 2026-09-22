import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInLeft, SlideInRight } from 'react-native-reanimated';

import type { Story } from '@/mock/data';
import { colors } from '@/theme';
import { AuthorRow } from './author-row';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from '@/components/text';

type Props = { stories: Story[] };

export function StoriesCard({ stories }: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const story = stories[index];
  const canPrev = index > 0;
  const canNext = index < stories.length - 1;

  const go = (dir: 1 | -1) => {
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= stories.length) return;
    setDirection(dir);
    setIndex(nextIndex);
  };

  const slide = (direction === 1 ? SlideInRight : SlideInLeft).duration(320);

  return (
    <View style={styles.card}>
      <Animated.View key={`head-${story.id}`} entering={FadeIn.duration(250)}>
        <AuthorRow author={story.author} />
      </Animated.View>

      <View style={styles.media}>
        <Animated.View key={story.id} entering={index === 0 && direction === 1 ? FadeIn.duration(250) : slide} style={StyleSheet.absoluteFill}>
          <Image source={story.image} style={styles.image} contentFit="cover" transition={200} />
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <Icon name="likeComment" width={87} height={36} />
        <View style={styles.arrows}>
          <ArrowButton icon="storyNext" enabled={canNext} onPress={() => go(1)} label="Next story" />
          <ArrowButton icon="storyPrev" enabled={canPrev} onPress={() => go(-1)} label="Previous story" />
        </View>
      </View>

      <Animated.View key={`cap-${story.id}`} entering={FadeIn.duration(250)} style={styles.captionBlock}>
        <Text style={styles.caption}>
          <Text style={styles.bold}>{story.caption.bold}</Text>
          {story.caption.rest}
        </Text>
        <Text style={styles.time}>{story.timeAgo}</Text>
      </Animated.View>
    </View>
  );
}

function ArrowButton({ icon, enabled, onPress, label }: { icon: 'storyPrev' | 'storyNext'; enabled: boolean; onPress: () => void; label: string }) {
  return (
    <PressableScale
      haptic
      scaleTo={0.88}
      disabled={!enabled}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      style={!enabled && styles.arrowDisabled}>
      <Icon name={icon} width={38} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 4 },
  media: { height: 291, marginTop: 8, overflow: 'hidden', backgroundColor: colors.surfaceSoft },
  image: { width: '100%', height: '100%' },
  actions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 5,
  },
  arrows: { flexDirection: 'row', gap: 9 },
  arrowDisabled: { opacity: 0.35 },
  captionBlock: { paddingHorizontal: 12, marginTop: 13, gap: 12 },
  caption: { fontSize: 13, lineHeight: 16, color: colors.text },
  bold: { fontWeight: '700' },
  time: { fontSize: 12, lineHeight: 16, color: colors.textSubtle },
});
