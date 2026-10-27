import { useFocusEffect, useScrollToTop } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, RefreshControl, StyleSheet, View, type FlatList } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, ZoomIn, ZoomOut, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useDerivedValue, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { FeedPost, FeedSeparator } from '@/components/feed-post';
import { FeedTabs } from '@/components/feed-tabs';
import { GrowIn } from '@/components/grow-in';
import { PostingRow } from '@/components/posting-row';
import { ContactsBlock } from '@/components/contacts-block';
import { PressableScale } from '@/components/pressable-scale';
import { HomeStories } from '@/components/home-stories';
import { PullSpinner } from '@/components/pull-spinner';
import type { Post } from '@/mock/data';
import { useFeed } from '@/state/feed';
import { colors, fonts } from '@/theme';
import { INTER_FAMILIES, Text } from '@/components/text';
import { homeChromeHidden } from '@/lib/chrome';
import { push } from '@/lib/nav';
import { CAPTURE } from '@/lib/capture';
import { unreadCount } from '@/lib/notifications';
import { pickStoryPhoto } from '@/lib/pick-cover';

export default function Home() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  // Unseen notifications, checked whenever Home comes into view (the notifications screen marks them read).
  const [unread, setUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (CAPTURE) return;
      let alive = true;
      unreadCount()
        .then((n) => alive && setUnread(n))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );
  const { posts, stories, tab, setTab, loadedTab, publishing, retryPublish, cancelPublish, loadMore, refresh, hidePost } = useFeed();
  // The header sits over the list and scrolls away with it, but stays put on pull-to-refresh: the stories
  // and posts come down and our spinner shows between them and the header. iOS pulls with its own bounce and
  // a RefreshControl with an invisible tint (it holds the list open while refreshing); Android lists don't
  // overscroll, so there a pan gesture drags the list down past the top.
  // Header and list sit 1 above the design's status-bar line (asked for after checking on the phone).
  const headerTop = insets.top - 1;
  const top = headerTop + HEADER_H;
  const y = useSharedValue(0);
  // where the in-list feed tabs sit in the page (content y), measured on layout
  const tabsY = useSharedValue(1000);
  // X-style chrome: the logo row and the tab bar slide away while scrolling down and come back as soon as the feed is
  // scrolled up. `hide` is how many points of the logo row are tucked away (0…BAR). The feed tabs stay in the page.
  const BAR = top;
  const prevY = useSharedValue(0);
  const hide = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    const yy = e.contentOffset.y;
    const dy = yy - prevY.get();
    prevY.set(yy);
    hide.set(yy <= 0 ? 0 : Math.min(BAR, Math.max(0, hide.get() + dy)));
    homeChromeHidden.set(hide.get() / BAR);
    y.set(yy);
  });
  useFocusEffect(
    useCallback(() => {
      homeChromeHidden.set(hide.get() / BAR);
    }, [hide, BAR]),
  );
  // The logo row scrolls away with the list near the top; further down it stays away (only the tab bar comes back on scroll up).
  const headerLineStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, (y.get() - BAR) / 12)) }));
  // The feed tabs follow the page up to just under the status bar. Scrolling up they come back there (sliding down from
  // above); near the top this is the same spot as the in-list row, so the hand-over is seamless.
  const pinTop = insets.top - 1;
  const pinnedStyle = useAnimatedStyle(() => {
    const p = 1 - hide.get() / BAR;
    const pinned = pinTop - (1 - p) * (TABS_H + pinTop);
    return { transform: [{ translateY: Math.max(pinned, tabsY.get() - y.get()) }] };
  });
  const headerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.max(y.get(), 0) }] }));

  // Switching feed tabs: the posts dip and come back (the mock feed is the same for every tab).
  const swap = useSharedValue(1);
  const onTab = useCallback(() => {
    swap.set(withSequence(withTiming(0, { duration: 120 }), withTiming(1, { duration: 260 })));
  }, [swap]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // at least as long as the spinner's turn, so a fast answer doesn't make it blink
    Promise.all([refresh(), new Promise((r) => setTimeout(r, 800))]).finally(() => setRefreshing(false));
  }, [refresh]);

  const drag = useSharedValue(0);
  const base = useSharedValue(0);
  const pull = useDerivedValue(() => (IOS ? Math.max(0, -y.value) : drag.value));
  useEffect(() => {
    if (!IOS) drag.set(withTiming(refreshing ? HOLD : 0, { duration: 220 }));
  }, [refreshing, drag]);
  const pan = Gesture.Pan()
    .enabled(!IOS)
    .activeOffsetY(8)
    .failOffsetX([-12, 12])
    .onBegin(() => {
      base.set(0);
    })
    .onUpdate((e) => {
      // Start counting from where the list reached its top; resistance like a rubber band.
      if (y.value > 0.5 && drag.value === 0) {
        base.set(e.translationY);
        return;
      }
      const d = Math.max(0, e.translationY - base.value);
      drag.set(Math.min(MAX_PULL, d * 0.5));
    })
    .onFinalize(() => {
      if (drag.value >= THRESHOLD) {
        drag.set(withTiming(HOLD, { duration: 180 }));
        runOnJS(onRefresh)();
      } else {
        drag.set(withTiming(0, { duration: 220 }));
      }
    });
  const native = Gesture.Native();

  const listStyle = useAnimatedStyle(() => ({ transform: [{ translateY: IOS ? 0 : drag.value }] }));
  // The status-bar cover is for posts passing under the status bar: it goes as the top bar comes back over it.
  const fadeStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(y.get(), 0) / top) }));

  // Tapping the Home tab again scrolls back to the top (on iOS the list's top is -top: it sits under the header via contentInset).
  const listRef = useRef<FlatList<Post>>(null);
  const scrollTarget = useMemo(
    () => ({ current: { scrollToTop: () => listRef.current?.scrollToOffset({ offset: 0, animated: true }) } }),
    [],
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
    const intro = now < introUntil.current;
    // Opening the screen: posts rise in one after another. Later, a new post at the top (a published article)
    // opens up room for itself, so the posts below glide down instead of jumping.
    if (first && !intro && index < 3) {
      return (
        <GrowIn>
          <FeedPost post={item} onHide={hidePost} />
          {index === 0 ? <ContactsBlock separator={<FeedSeparator />} /> : null}
        </GrowIn>
      );
    }
    const entering = first && intro ? FadeInDown.delay(Math.min(index, 4) * 70).duration(380) : undefined;
    return (
      <Animated.View collapsable={false} entering={entering}>
        <Swap value={swap}>
          <FeedPost post={item} onHide={hidePost} />
          {/* AutoLayouted-39: the contacts cards come after the first post, between two separators */}
          {index === 0 ? (
            <ContactsBlock separator={<FeedSeparator />} />
          ) : null}
        </Swap>
      </Animated.View>
    );
  }, [hidePost, swap]);

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
        onEndReached={loadMore}
        // Not designed: an empty tab says why
        ListEmptyComponent={
          loadedTab ? (
            <Animated.View collapsable={false} entering={FadeIn.duration(250)}>
              <Text style={styles.empty}>
                {tab === 'Following' ? 'Posts from people you follow will show up here.' : tab === 'Saved' ? 'Posts you bookmark will show up here.' : tab === 'History' ? 'Posts you read will show up here.' : 'No posts yet.'}
              </Text>
            </Animated.View>
          ) : undefined
        }
        onEndReachedThreshold={1.5}
        // Posts are ~500pt tall: a few per batch keeps the JS thread free; Android detaches posts far off screen.
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={7}
        removeClippedSubviews={!IOS}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <>
            <Animated.View collapsable={false} entering={FadeInDown.duration(380)} style={styles.stories}>
              <HomeStories stories={stories} />
            </Animated.View>
            <View style={styles.tabsGap} onLayout={(e) => tabsY.set(top + e.nativeEvent.layout.y)}>
              <FeedTabs
                value={tab}
                onChange={(t) => {
                  onTab();
                  setTab(t);
                }}
              />
            </View>
          </>
        }
        ItemSeparatorComponent={FeedSeparator}
        ListHeaderComponentStyle={styles.storiesGap}
        // Plain top padding on both platforms: with contentInset iOS sometimes came back short of the top after a
        // long scroll and the story rings stayed half under the header.
        // the tab bar floats over Home (it slides away), so the feed leaves room for it at the end
        contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: 24 + 48 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={IOS ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" /> : undefined}
      />
      </GestureDetector>
      </Animated.View>
      <Animated.View collapsable={false} pointerEvents="box-none" style={[styles.headerWrap, { top: headerTop }, headerStyle]}>
            {/* white behind the status bar too, for when the bar comes back over the feed */}
            <View style={[styles.headerCap, { top: -headerTop, height: headerTop }]} />
            <View style={styles.headerBg} />
            {/* over the feed (not at the top of the page): a hairline under the logo row */}
            <Animated.View style={[styles.headerLine, headerLineStyle]} />
            <View style={styles.header}>
              <PressableScale haptic onPress={pickStoryPhoto} hitSlop={12} accessibilityLabel="New story" style={styles.plus}>
                <Icon name="homePlus" width={20} height={20} />
              </PressableScale>
              {/* NBSPs on both sides: Android clips script glyphs at the line's advance width; symmetric keeps it centred. */}
              <Text style={styles.logo}>{' Thoughts '}</Text>
              <PressableScale haptic onPress={() => push('/notifications')} hitSlop={10} accessibilityLabel="Notifications" style={styles.bell}>
                <Icon name="homeBell" width={20} height={22.5} />
                {/* Not designed: a red dot while there are unseen notifications */}
                {unread ? <Animated.View collapsable={false} entering={ZoomIn.duration(220)} exiting={ZoomOut.duration(160)} style={styles.bellDot} /> : null}
              </PressableScale>
            </View>
      </Animated.View>
      {/* Content scrolls under the status bar and fades out there (69px in the frame = status bar + 22). */}
      {/* SVG gradient via expo-image: expo-linear-gradient is not in the Android dev build. */}
      {/* While the bar is away: solid white behind the status bar down to design y 45, then a 0.75 #E9E9E9 line */}
      <Animated.View pointerEvents="none" style={[styles.fade, { height: insets.top - 2 }, fadeStyle]} />
      {/* the feed tabs again, over the page: pinned under the status bar while scrolling up */}
      <Animated.View collapsable={false} pointerEvents="box-none" style={[styles.pinnedTabs, pinnedStyle]}>
        <FeedTabs
          value={tab}
          onChange={(t) => {
            onTab();
            setTab(t);
          }}
        />
      </Animated.View>
      {/* AutoLayouted-40: "Posting..." floats 8 above the tab bar (whose top is 47 above the home indicator) */}
      {publishing && !publishing.done ? (
        <PostingRow publishing={publishing} bottom={insets.bottom + 49 + 8} onRetry={retryPublish} onCancel={cancelPublish} onOpen={(id) => push(`/article/${id}`)} />
      ) : null}
    </View>
  );
}

function Swap({ value, children }: { value: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ opacity: value.get(), transform: [{ translateY: (1 - value.get()) * 10 }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const IOS = Platform.OS === 'ios';
const HEADER_H = 60;
// Pull-to-refresh: spokes complete and release refreshes at THRESHOLD, the list waits at HOLD meanwhile.
const TABS_H = 51.5;
const THRESHOLD = 64;
const HOLD = 52;
const MAX_PULL = 140;
// Posts first mounted within this time after the screen opens get the staggered entrance.
const INTRO_MS = 1000;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  // AutoLayouted-12: "Thoughts" (Caveat 37.2) ink centred on x 192.3 (Caveat's ink sits 4.7 right of its advance), ink top at y 62.4; Frame 1198: plus at (21, 65), bell 20x23 at (342, 63.8); AutoLayouted-12: story rings at y 107;
  // first avatar at 240.5.
  headerWrap: { position: 'absolute', left: 0, right: 0 },
  // stops 7 short of the header's bottom: the story rings start 2 above it and their tops were cut off
  headerBg: { position: 'absolute', left: 0, right: 0, top: 0, height: HEADER_H - 7, backgroundColor: colors.bg },
  headerLine: { position: 'absolute', left: 0, right: 0, top: HEADER_H - 6, height: 0.5, backgroundColor: '#E9E9E9' },
  header: { height: HEADER_H, alignItems: 'center' },
  // AutoLayouted-34 (BG(2)): plus at (22.5, 61.5), bell at (343.5, 61) incl. their strokes; logo ink 107.3 wide from
  // 140.6 × 59.9; story rings 94 at x 12 + 113n, y 104.5.
  plus: { position: 'absolute', left: 22.5, top: 15.5 },
  bell: { position: 'absolute', left: 343.5, top: 15 },
  // Fixed box well wider/taller than the glyphs (Caveat overhangs its advance box; Android clips at the view edge).
  logo: { marginTop: -1.3, width: 166, height: 50, textAlign: 'center', fontFamily: fonts.logoMedium, fontSize: 39, lineHeight: 50, color: colors.text, transform: [{ translateX: -4.35 }] },
  fade: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.bg },
  content: { paddingBottom: 24 },
  // first post's avatar 12.25 under the tabs' line (the post's own top is 13.05)
  headerCap: { position: 'absolute', left: 0, right: 0, backgroundColor: colors.bg },
  storiesGap: { marginBottom: 0.7 },
  // 1 more between the stories and the tabs (everything below moves down with them)
  tabsGap: { marginTop: 1 },
  pinnedTabs: { position: 'absolute', top: 0, left: 0, right: 0, height: TABS_H, backgroundColor: colors.bg },
  bellDot: { position: 'absolute', right: -1, top: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3040', borderWidth: 1.5, borderColor: colors.bg },
  empty: { marginTop: 60, marginHorizontal: 40, textAlign: 'center', fontFamily: INTER_FAMILIES['400'], fontSize: 14.5, lineHeight: 20, color: colors.textMuted },
  stories: { marginTop: -2, marginLeft: -2.5 },
});
