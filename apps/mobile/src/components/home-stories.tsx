import { Image } from 'expo-image';
import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type HostInstance } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import type { Story } from '@/mock/data';
import { colors } from '@/theme';
import { PressableScale } from './pressable-scale';
import { RingSweep, SeenRing, StoryRing } from './ring-sweep';
import { Text, sf } from '@/components/text';
import { push } from '@/lib/nav';
import { onStoriesClosing, setStoryOrigin } from '@/lib/story-origin';
import { useSeenStories } from '@/state/feed';

// AutoLayouted-12: rings 97 (3px black stroke) every 113 from x 11.5, photo 85 inside a 3px white gap; the username
// 3.3 under the ring. Watched stories get the grey ring.
const RING = 97;
const STEP = 113;
const PHOTO = 85;

// Overscroll like Instagram: the row barely gives at either end and every story stretches a touch
// horizontally, so the stretch adds up into a wave away from the pulled edge. iOS takes back most of the
// native bounce; Android uses the system stretch.
const GIVE = 0.05;
const STRETCH = 0.000175; // scaleX gained per point of overscroll
// The viewer takes ~340ms to shrink back: the grey starts as it lands, rings after the first follow a beat apart.
const SWEEP_ON_CLOSE = 180;
const SWEEP_STAGGER = 50;

export function HomeStories({ stories }: { stories: Story[] }) {
  const x = useSharedValue(0);
  const max = useSharedValue(0);
  const contentW = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.set(e.contentOffset.x);
    max.set(Math.max(0, contentW.value - e.layoutMeasurement.width));
  });

  // Watched stories turn grey in front of the user: the grey runs round the ring as the viewer shrinks back into
  // Home (it reports closing with the stories watched); Home regaining focus is the fallback.
  const { seenStories } = useSeenStories();
  const [grey, setGrey] = useState<ReadonlySet<string>>(() => new Set(stories.filter((s) => s.seen).map((s) => s.id)));
  // Story id → delay before its grey starts.
  const [sweeping, setSweeping] = useState<ReadonlyMap<string, number>>(() => new Map());
  const startSweeps = useCallback(
    (ids: string[], delay: number) =>
      setSweeping((v) => {
        const fresh = ids.filter((id) => !grey.has(id) && !v.has(id));
        if (!fresh.length) return v;
        const n = new Map(v);
        fresh.forEach((id, i) => n.set(id, delay + i * SWEEP_STAGGER));
        return n;
      }),
    [grey],
  );
  useEffect(() => onStoriesClosing((watched) => startSweeps(watched, SWEEP_ON_CLOSE)), [startSweeps]);
  useFocusEffect(
    useCallback(() => {
      startSweeps(
        stories.filter((s) => s.seen || seenStories.has(s.id)).map((s) => s.id),
        0,
      );
    }, [stories, seenStories, startSweeps]),
  );
  // Opening a story: remember where every visible story photo is (the viewer grows out of the tapped one and
  // shrinks back into whichever story it is closed on), then open it once the tapped one is measured.
  const rings = useRef(new Map<string, HostInstance>());
  const registerRing = useCallback((id: string, view: HostInstance | null) => {
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

  // The finished sweep hands over to the plain grey ring in one update: both are the same bordered view, and
  // keeping the sweep on top a moment longer doubled the ring's soft edges, so it looked darker than a ring
  // that was grey from the start.
  const sweepDone = useCallback((id: string) => {
    setGrey((v) => new Set(v).add(id));
    setSweeping((v) => {
      const n = new Map(v);
      n.delete(id);
      return n;
    });
  }, []);

  return (
    <Animated.ScrollView
      horizontal
      onScroll={onScroll}
      scrollEventThrottle={16}
      onContentSizeChange={(w) => (contentW.set(w))}
      overScrollMode={Platform.OS === 'android' ? 'always' : undefined}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {stories.map((s, i) => (
        <Item key={s.id} story={s} index={i} count={stories.length} x={x} max={max} grey={grey.has(s.id)} sweepDelay={sweeping.get(s.id) ?? null} onSweepDone={sweepDone} onOpen={openStory} registerRing={registerRing} />
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
  /** Set while the ring is turning grey. */
  sweepDelay: number | null;
  onSweepDone: (id: string) => void;
  onOpen: (id: string) => void;
  registerRing: (id: string, view: HostInstance | null) => void;
};

function Item({ story: s, index, count, x, max, grey, sweepDelay, onSweepDone, onOpen, registerRing }: ItemProps) {
  const done = useCallback(() => onSweepDone(s.id), [onSweepDone, s.id]);
  const style = useAnimatedStyle(() => {
    const o = x.value < 0 ? x.value : x.value > max.value ? x.value - max.value : 0;
    if (o === 0) return { transform: [{ translateX: 0 }, { scaleX: 1 }] };
    const grow = STRETCH * Math.abs(o);
    const extra = STEP * grow; // each stretched story pushes the next one along
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
          {grey ? <SeenRing size={RING} /> : <StoryRing size={RING} />}
          {sweepDelay !== null ? <RingSweep size={RING} delay={sweepDelay} onDone={done} /> : null}
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {s.author.username}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { paddingLeft: 11.5, paddingRight: 8, gap: STEP - RING },
  item: { width: RING, alignItems: 'center' },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  photo: { width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2, backgroundColor: colors.surfaceSoft },
  name: { marginTop: 3.3, maxWidth: 92, ...sf('400'), fontSize: 11.95, lineHeight: 15, letterSpacing: 0, color: colors.text },
});
