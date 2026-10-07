import { Image } from 'expo-image';
import { useScrollToTop } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, RefreshControl, StyleSheet, View, type FlatList } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { FeedPost } from '@/components/feed-post';
import { PostingRow } from '@/components/posting-row';
import { PressableScale } from '@/components/pressable-scale';
import { HomeStories } from '@/components/home-stories';
import { PullSpinner } from '@/components/pull-spinner';
import { HOME_STORIES, type Post } from '@/mock/data';
import { useFeed } from '@/state/feed';
import { colors, fonts } from '@/theme';
import { Text } from '@/components/text';
import { push } from '@/lib/nav';

export default function Home() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const { posts, publishing, seenStories } = useFeed();
  const stories = useMemo(() => HOME_STORIES.map((s) => (seenStories.has(s.id) ? { ...s, seen: true } : s)), [seenStories]);
  // The header sits over the list and scrolls away with it, but stays put on pull-to-refresh: the stories
  // and posts come down and our spinner shows between them and the header. iOS pulls with its own bounce and
  // a RefreshControl with an invisible tint (it holds the list open while refreshing); Android lists don't
  // overscroll, so there a pan gesture drags the list down past the top.
  const top = insets.top + HEADER_H;
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y + (IOS ? top : 0);
  });
  // Clamped once it is off screen, so scrolling further down doesn't push a style update every frame.
  const headerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.min(Math.max(y.value, 0), top) }] }));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const drag = useSharedValue(0);
  const base = useSharedValue(0);
  const pull = useDerivedValue(() => (IOS ? Math.max(0, -y.value) : drag.value));
  useEffect(() => {
    if (!IOS) drag.value = withTiming(refreshing ? HOLD : 0, { duration: 220 });
  }, [refreshing, drag]);
  const pan = Gesture.Pan()
    .enabled(!IOS)
    .activeOffsetY(8)
    .failOffsetX([-12, 12])
    .onBegin(() => {
      base.value = 0;
    })
    .onUpdate((e) => {
      // Start counting from where the list reached its top; resistance like a rubber band.
      if (y.value > 0.5 && drag.value === 0) {
        base.value = e.translationY;
        return;
      }
      const d = Math.max(0, e.translationY - base.value);
      drag.value = Math.min(MAX_PULL, d * 0.5);
    })
    .onFinalize(() => {
      if (drag.value >= THRESHOLD) {
        drag.value = withTiming(HOLD, { duration: 180 });
        runOnJS(onRefresh)();
      } else {
        drag.value = withTiming(0, { duration: 220 });
      }
    });
  const native = Gesture.Native();
  const listStyle = useAnimatedStyle(() => ({ transform: [{ translateY: IOS ? 0 : drag.value }] }));

  // Tapping the Home tab again scrolls back to the top (on iOS the list's top is -top: it sits under the header via contentInset).
  const listRef = useRef<FlatList<Post>>(null);
  const scrollTarget = useMemo(
    () => ({ current: { scrollToTop: () => listRef.current?.scrollToOffset({ offset: IOS ? -top : 0, animated: true }) } }),
    [top],
  );
  useScrollToTop(scrollTarget);

  // FlatList mounts posts lazily while scrolling and remounts ones it dropped off-screen: those must appear as they
  // are, not fade in mid-scroll. A post animates in only on its first mount, while the screen opens or at the top (new post).
  const seen = useRef(new Set<string>());
  const introUntil = useRef<number | null>(null);
  const renderItem = useCallback(({ item, index }: { item: Post; index: number }) => {
    const now = Date.now();
    introUntil.current ??= now + INTRO_MS;
    const first = !seen.current.has(item.id);
    seen.current.add(item.id);
    const animate = first && (now < introUntil.current || index < 3);
    return (
      <Animated.View collapsable={false} entering={animate ? FadeInDown.delay(Math.min(index, 4) * 70).duration(380) : undefined}>
        <FeedPost post={item} />
      </Animated.View>
    );
  }, []);

  return (
    <View style={styles.root}>
      <PullSpinner pull={pull} threshold={THRESHOLD} refreshing={refreshing} top={top} />
      <Animated.View collapsable={false} style={[styles.list, listStyle]}>
      {/* The native gesture goes on the list itself: on a wrapping view Android forwards touches to it and the scroll got stuck. */}
      <GestureDetector gesture={Gesture.Simultaneous(pan, native)}>
      <Animated.FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        onScroll={onScroll}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={7}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <>
            <Animated.View collapsable={false} entering={FadeInDown.duration(380)}>
              <HomeStories stories={stories} />
            </Animated.View>
            {publishing ? <PostingRow coverUri={publishing.coverUri} /> : null}
          </>
        }
        ItemSeparatorComponent={Separator}
        ListHeaderComponentStyle={publishing ? styles.postingGap : styles.storiesGap}
        contentInset={IOS ? { top } : undefined}
        contentOffset={IOS ? { x: 0, y: -top } : undefined}
        scrollIndicatorInsets={IOS ? { top } : undefined}
        contentContainerStyle={[styles.content, IOS ? null : { paddingTop: top }]}
        showsVerticalScrollIndicator={false}
        refreshControl={IOS ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" /> : undefined}
      />
      </GestureDetector>
      </Animated.View>
      <Animated.View collapsable={false} pointerEvents="box-none" style={[styles.headerWrap, { top: insets.top }, headerStyle]}>
            <View style={styles.header}>
              <PressableScale haptic onPress={() => push('/story/new')} hitSlop={12} accessibilityLabel="New story" style={styles.plus}>
                <Icon name="homePlus" width={21} />
              </PressableScale>
              {/* NBSPs on both sides: Android clips script glyphs at the line's advance width; symmetric keeps it centred. */}
              <Text style={styles.logo}>{' Smarts '}</Text>
              <PressableScale haptic onPress={() => push('/notifications')} hitSlop={10} accessibilityLabel="Notifications" style={styles.bell}>
                <Icon name="homeBell" width={20} height={23} />
              </PressableScale>
            </View>
      </Animated.View>
      {/* Content scrolls under the status bar and fades out there (69px in the frame = status bar + 22). */}
      {/* SVG gradient via expo-image: expo-linear-gradient is not in the Android dev build. */}
      <Image
        pointerEvents="none"
        source={require('@/assets/fade-top.svg')}
        contentFit="fill"
        style={[styles.fade, { height: insets.top + 22 }]}
      />
    </View>
  );
}

const IOS = Platform.OS === 'ios';
const HEADER_H = 62.75;
// Pull-to-refresh: spokes complete and release refreshes at THRESHOLD, the list waits at HOLD meanwhile.
const THRESHOLD = 64;
const HOLD = 52;
const MAX_PULL = 140;
// Posts first mounted within this time after the screen opens get the staggered entrance.
const INTRO_MS = 1000;

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  // Frame 1049 home (status bar 47): plus 21 at (14, 64), "Smarts" (Caveat 36.5) centred 3px left of the
  // screen centre on y 73.2, bell 20x23 at (351, 62.8); story rings start at y 109.75; first avatar at 242.25.
  headerWrap: { position: 'absolute', left: 0, right: 0 },
  header: { height: HEADER_H, alignItems: 'center' },
  plus: { position: 'absolute', left: 14, top: 17 },
  bell: { position: 'absolute', left: 351, top: 15.8 },
  // Fixed box well wider/taller than the glyphs (Caveat overhangs its advance box; Android clips at the view edge).
  logo: { marginTop: 1.2, width: 160, height: 50, textAlign: 'center', fontFamily: fonts.logoMedium, fontSize: 38.5, lineHeight: 50, color: colors.text, transform: [{ translateX: -3.1 }] },
  fade: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { paddingBottom: 24 },
  storiesGap: { marginBottom: 16.25 },
  postingGap: { marginBottom: 32 },
  separator: { height: 37 },
});
