import { Image } from 'expo-image';
import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import type { Story } from '@/mock/data';
import { colors } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { RingSweep } from './ring-sweep';
import { Text } from '@/components/text';
import { push } from '@/lib/nav';
import { setStoryOrigin } from '@/lib/story-origin';

// Frame 1049 home: rings 97.5 (3.25 gradient stroke) every 108 from x 3.75, photo 85 inside a 3px white
// stroke; the username baseline 15.85 under the ring. Watched stories get the grey ring.
const RING = 97.5;
const PHOTO = 85;

// Overscroll like Instagram: the row barely gives at either end and every story stretches a touch
// horizontally, so the stretch adds up into a wave away from the pulled edge. iOS takes back most of the
// native bounce; Android uses the system stretch.
const GIVE = 0.05;
const STRETCH = 0.000175; // scaleX gained per point of overscroll
const SEEN_GREY = '#DBE0E6'; // story-ring-seen.svg

export function HomeStories({ stories }: { stories: Story[] }) {
  const x = useSharedValue(0);
  const max = useSharedValue(0);
  const contentW = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
    max.value = Math.max(0, contentW.value - e.layoutMeasurement.width);
  });

  // Stories watched while Home was covered turn grey in front of the user once Home is back: the ring stays in
  // colour until then, and the grey runs round it.
  const [grey, setGrey] = useState<ReadonlySet<string>>(() => new Set(stories.filter((s) => s.seen).map((s) => s.id)));
  const [sweeping, setSweeping] = useState<ReadonlySet<string>>(() => new Set());
  useFocusEffect(
    useCallback(() => {
      const fresh = stories.filter((s) => s.seen && !grey.has(s.id) && !sweeping.has(s.id)).map((s) => s.id);
      if (fresh.length) setSweeping((v) => new Set([...v, ...fresh]));
    }, [stories, grey, sweeping]),
  );
  // Opening a story: remember where every visible story photo is (the viewer grows out of the tapped one and
  // shrinks back into whichever story it is closed on), then open it once the tapped one is measured.
  const rings = useRef(new Map<string, View>());
  const registerRing = useCallback((id: string, view: View | null) => {
    if (view) rings.current.set(id, view);
    else rings.current.delete(id);
  }, []);
  const openStory = useCallback((id: string) => {
    let opened = false;
    const go = () => {
      if (opened) return;
      opened = true;
      push(`/story/${id}` as Href);
    };
    rings.current.forEach((view, key) =>
      view.measureInWindow((x, y, w) => {
        const inset = (w - PHOTO) / 2;
        setStoryOrigin(key, { x: x + inset, y: y + inset, size: PHOTO });
        if (key === id) go();
      }),
    );
    // Never stay stuck if measuring fails.
    setTimeout(go, 120);
  }, []);

  const sweepDone = useCallback((id: string) => {
    setGrey((v) => new Set(v).add(id));
    setSweeping((v) => {
      const n = new Set(v);
      n.delete(id);
      return n;
    });
  }, []);

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
        <Item key={s.id} story={s} index={i} count={stories.length} x={x} max={max} grey={grey.has(s.id)} sweep={sweeping.has(s.id)} onSweepDone={sweepDone} onOpen={openStory} registerRing={registerRing} />
      ))}
    </Animated.ScrollView>
  );
}

type ItemProps = {
  story: Story;
  index: number;
  count: number;
  x: SharedValue<number>;
  max: SharedValue<number>;
  grey: boolean;
  sweep: boolean;
  onSweepDone: (id: string) => void;
  onOpen: (id: string) => void;
  registerRing: (id: string, view: View | null) => void;
};

function Item({ story: s, index, count, x, max, grey, sweep, onSweepDone, onOpen, registerRing }: ItemProps) {
  const done = useCallback(() => onSweepDone(s.id), [onSweepDone, s.id]);
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
        onPress={() => onOpen(s.id)}
        accessibilityRole="button"
        accessibilityLabel={`${s.author.username} story`}
        style={styles.item}>
        <View ref={(v) => registerRing(s.id, v)} collapsable={false} style={styles.ring}>
          <Image source={s.image} style={styles.photo} contentFit="cover" transition={150} />
          <Icon name={grey ? 'storyRingSeen' : 'storyRing'} width={RING} style={StyleSheet.absoluteFill} />
          {/* Starts a moment after Home is back (the viewer is still fading out). */}
          {sweep ? <RingSweep size={RING} color={SEEN_GREY} delay={250 + index * 60} onDone={done} /> : null}
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
