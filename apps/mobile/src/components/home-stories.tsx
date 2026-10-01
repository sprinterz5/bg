import { Image } from 'expo-image';
import type { Href } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import type { Story } from '@/mock/data';
import { colors } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from '@/components/text';
import { push } from '@/lib/nav';

// Frame 1049 home: rings 97.5 (3.25 gradient stroke) every 108 from x 3.75, photo 85 inside a 3px white
// stroke; the username baseline 15.85 under the ring. Watched stories get the grey ring.
const RING = 97.5;
const PHOTO = 85;

// Overscroll like Instagram: the row barely gives at either end and every story stretches a touch
// horizontally, so the stretch adds up into a wave away from the pulled edge. iOS takes back most of the
// native bounce; Android uses the system stretch.
const GIVE = 0.05;
const STRETCH = 0.0005; // scaleX gained per point of overscroll

export function HomeStories({ stories }: { stories: Story[] }) {
  const x = useSharedValue(0);
  const max = useSharedValue(0);
  const contentW = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
    max.value = Math.max(0, contentW.value - e.layoutMeasurement.width);
  });

  return (
    <Animated.ScrollView
      horizontal
      onScroll={onScroll}
      scrollEventThrottle={16}
      onContentSizeChange={(w) => (contentW.value = w)}
      overScrollMode={Platform.OS === 'android' ? 'always' : undefined}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {stories.map((s, i) => (
        <Item key={s.id} story={s} index={i} count={stories.length} x={x} max={max} />
      ))}
    </Animated.ScrollView>
  );
}

function Item({ story: s, index, count, x, max }: { story: Story; index: number; count: number; x: SharedValue<number>; max: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const o = x.value < 0 ? x.value : x.value > max.value ? x.value - max.value : 0;
    if (o === 0) return { transform: [{ translateX: 0 }, { scaleX: 1 }] };
    const grow = STRETCH * Math.abs(o);
    const extra = (RING + 108 - RING) * grow; // each stretched story pushes the next one along
    const fromEdge = o < 0 ? index : count - 1 - index;
    const wave = (fromEdge * extra + (RING * grow) / 2) * (o < 0 ? 1 : -1);
    return { transform: [{ translateX: o * (1 - GIVE) + wave }, { scaleX: 1 + grow }] };
  });

  return (
    <Animated.View collapsable={false} style={style}>
      <PressableScale
        onPress={() => push(`/story/${s.id}` as Href)}
        accessibilityRole="button"
        accessibilityLabel={`${s.author.username} story`}
        style={styles.item}>
        <View style={styles.ring}>
          <Image source={s.image} style={styles.photo} contentFit="cover" transition={150} />
          <Icon name={s.seen ? 'storyRingSeen' : 'storyRing'} width={RING} style={StyleSheet.absoluteFill} />
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {s.author.username}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { paddingLeft: 3.75, paddingRight: 8, gap: 108 - RING },
  item: { width: RING, alignItems: 'center' },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  photo: { width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2, backgroundColor: colors.surfaceSoft },
  name: { marginTop: 4.75, maxWidth: RING + 10, fontSize: 12, lineHeight: 15, color: colors.text },
});
