import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Keyboard, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { Easing, runOnJS, runOnUI, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthorAvatar } from '@/components/author-row';
import { Icon } from '@/components/icon';
import { CURL_SUPPORTED, PageCurlCanvas, disposeSnapshot, snapshotView, type Snapshot } from '@/components/page-curl';
import { PressableScale } from '@/components/pressable-scale';
import { Text, TextInput } from '@/components/text';
import { backWhenReady } from '@/lib/nav';
import { storiesClosing, storyOrigin } from '@/lib/story-origin';
import { HOME_STORIES, type Story } from '@/mock/data';
import { useSeenStories } from '@/state/feed';

// Frame 1049 story viewer (design status bar 47, home indicator 34). Photo centred on design y 385,
// up to 540 tall; author row 93 and caption 46 above the bottom bar; bar 51 + indicator, #0D1015.
const BAR = '#0D1015';
const MUTED = '#8E8E93';
const MAX_H = 540;

// Page turn between stories (not in the design): swipe or tap the right/left half. The previous, current and
// next pages are mounted on top of each other (current on top) and snapshotted. During a turn the curl canvas
// paints the whole frame over the live pages: the current snapshot turning away over the next one, or the
// previous one coming back over the current one; when the turn is done the live page under it is the same.
const TURN_EASING = Easing.bezier(0.45, 0.05, 0.25, 1);
const RELEASE_EASING = Easing.out(Easing.cubic);
const TURN_MS = 620;
// Characters taken off the second caption line to make room for "...more".
const MORE_CHARS = 8;
const CAPTION_LH = 15.65;
const CAPTION_SLACK = 3;
const CAPTION_MS = 320;
// Open / close (not in the design): the viewer grows out of the story's photo on Home and shrinks back into it.
const OPEN_MS = 420;
const CLOSE_MS = 340;
const OPEN_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
const CLOSE_EASING = Easing.bezier(0.4, 0, 0.2, 1);

export default function StoryViewer() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [index, setIndex] = useState(() => Math.max(0, HOME_STORIES.findIndex((s) => s.id === id)));
  const story = HOME_STORIES[index];
  const prev: Story | undefined = HOME_STORIES[index - 1];
  const next: Story | undefined = HOME_STORIES[index + 1];
  const barH = 51 + Math.max(insets.bottom, 12);

  // Open / close. `t`: 0 = the window is the story photo on Home (origin), 1 = full screen. The window clips the
  // viewer; inside it the viewer is scaled so its photo fills the circle, centred, at t 0. Swiping down drags the
  // window and shrinks it; letting go far enough closes into the current story's photo on Home (or fades out when
  // Home didn't report where that is).
  const [origin0] = useState(() => storyOrigin(id ?? ''));
  const t = useSharedValue(origin0 ? 0 : 1);
  const fade = useSharedValue(origin0 ? 1 : 0);
  const dragY = useSharedValue(0);
  const ox = useSharedValue(origin0?.x ?? 0);
  const oy = useSharedValue(origin0?.y ?? 0);
  const os = useSharedValue(origin0?.size ?? width);
  // Only the opened page is mounted while the window grows; the pages next to it, the curl canvas and the
  // snapshots (a full software redraw of the page on Android) come once it's done, so nothing competes with it.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const done = (fin?: boolean) => {
      'worklet';
      if (fin) runOnJS(setSettled)(true);
    };
    if (origin0) t.value = withTiming(1, { duration: OPEN_MS, easing: OPEN_EASING }, done);
    else fade.value = withTiming(1, { duration: 200 }, done);
  }, [origin0, t, fade]);

  // Every story shown here counts as watched (grey ring on Home). Recorded when the viewer closes, not while it
  // opens: marking re-renders the stories row under it.
  const { markStoriesSeen } = useSeenStories();
  const watched = useRef(new Set<string>());
  useEffect(() => {
    watched.current.add(story.id);
  }, [story.id]);
  useEffect(() => () => markStoriesSeen([...watched.current]), [markStoriesSeen]);

  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    const seen = [...watched.current];
    markStoriesSeen(seen);
    storiesClosing(seen);
    const o = storyOrigin(story.id);
    if (o) {
      runOnUI((x: number, y: number, size: number) => {
        'worklet';
        ox.value = x;
        oy.value = y;
        os.value = size;
        dragY.value = withTiming(0, { duration: CLOSE_MS, easing: CLOSE_EASING });
        t.value = withTiming(0, { duration: CLOSE_MS, easing: CLOSE_EASING }, (fin) => {
          if (fin) runOnJS(backWhenReady)();
        });
      })(o.x, o.y, o.size);
    } else {
      fade.value = withTiming(0, { duration: 200 }, (fin) => {
        if (fin) runOnJS(backWhenReady)();
      });
    }
  }, [story.id, ox, oy, os, dragY, t, fade, markStoriesSeen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const photoCY = insets.top + (385 - 47);
  const frameStyle = useAnimatedStyle(() => {
    const k = t.value;
    const d = os.value;
    const drag = Math.max(0, dragY.value);
    return {
      left: ox.value * (1 - k),
      top: oy.value * (1 - k),
      width: d + (width - d) * k,
      height: d + (height - d) * k,
      borderRadius: (d / 2) * (1 - k) + Math.min(drag * 0.15, 22),
      opacity: fade.value,
      transform: [{ translateY: drag * 0.9 }, { scale: 1 - Math.min(drag / height, 1) * 0.35 }],
    };
  });
  // Keeps the viewer's photo centre (width / 2, photoCY) on the window's centre at t 0 and in place at t 1.
  const innerStyle = useAnimatedStyle(() => {
    const k = t.value;
    const d = os.value;
    const sc = d / width + (1 - d / width) * k;
    const w = d + (width - d) * k;
    const ty = d / 2 + (photoCY - d / 2) * k;
    return {
      transform: [
        { translateX: w / 2 - width / 2 },
        { translateY: ty - height / 2 - sc * (photoCY - height / 2) },
        { scale: sc },
      ],
    };
  });

  const [snaps, setSnaps] = useState<Record<string, Snapshot>>({});
  const onSnapshot = useCallback((storyId: string, image: Snapshot) => {
    setSnaps((s) => {
      const old = s[storyId];
      // Not right away: the canvas may still be drawing it this frame.
      if (old) setTimeout(() => disposeSnapshot(old), 1000);
      return { ...s, [storyId]: image };
    });
  }, []);

  // Free the GPU snapshots when the viewer closes.
  const snapsRef = useRef(snaps);
  useEffect(() => {
    snapsRef.current = snaps;
  }, [snaps]);
  useEffect(() => () => Object.values(snapsRef.current).forEach((img) => setTimeout(() => disposeSnapshot(img), 1000)), []);

  const progress = useSharedValue(0); // 0 = page flat, 1 = turned away
  const angle = useSharedValue(0);
  const active = useSharedValue(''); // snapshot being turned
  const under = useSharedValue(''); // snapshot drawn flat under it
  // Fallback when the next page has no snapshot: its live view is shown under the curl and the current live page
  // is hidden, but only once the turn is under way (the canvas then surely draws already).
  const hidden = useSharedValue('');
  // 1 / -1: turning forward / back; 3 / -3: switching without the curl (no snapshot yet); 2: swiping past the last story.
  const mode = useSharedValue(0);
  const owner = useSharedValue(0); // the running pan started the current turn
  const startY = useSharedValue(0);

  const commit = useCallback((step: number) => {
    Haptics.selectionAsync();
    setIndex((i) => i + step);
  }, []);

  // The new top page is mounted: drop the turn layer (it shows the same pixels) and the snapshots that left the window.
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() =>
        runOnUI(() => {
          'worklet';
          active.value = '';
          under.value = '';
          hidden.value = '';
          progress.value = 0;
          mode.value = 0;
        })(),
      );
    });
    const keep = new Set([HOME_STORIES[index - 1]?.id, HOME_STORIES[index].id, HOME_STORIES[index + 1]?.id]);
    setSnaps((s) => {
      const out: Record<string, Snapshot> = {};
      let dropped = false;
      for (const [k, v] of Object.entries(s)) {
        if (keep.has(k)) out[k] = v;
        else {
          dropped = true;
          setTimeout(() => disposeSnapshot(v), 1000);
        }
      }
      return dropped ? out : s;
    });
    return () => cancelAnimationFrame(raf);
  }, [index, active, under, hidden, progress, mode]);

  const canForward = CURL_SUPPORTED && !!next && !!snaps[story.id];
  const nextSnapped = !!next && !!snaps[next.id];
  const canBack = CURL_SUPPORTED && !!prev && !!snaps[prev.id] && !!snaps[story.id];
  const currentId = story.id;
  const prevId = prev?.id ?? '';
  const nextId = next?.id ?? '';

  // The first draw of the curl shader compiles it on the GPU (a visible hitch): do it once up front, turned fully
  // away so nothing shows.
  const warmed = useRef(false);
  useEffect(() => {
    if (!CURL_SUPPORTED || warmed.current || !snaps[currentId]) return;
    warmed.current = true;
    runOnUI((id: string) => {
      'worklet';
      if (mode.value !== 0) return;
      progress.value = 1;
      active.value = id;
    })(currentId);
    const t = setTimeout(
      () =>
        runOnUI(() => {
          'worklet';
          if (mode.value !== 0) return;
          active.value = '';
          progress.value = 0;
        })(),
      200,
    );
    return () => clearTimeout(t);
  }, [snaps, currentId, mode, progress, active]);
  const hasNext = !!next;
  const hasPrev = !!prev;

  const startTurn = (step: number, layer: string, base: string, tilt: number) => {
    'worklet';
    mode.value = step;
    angle.value = tilt;
    progress.value = step === 1 ? 0 : 1;
    if (step === 1 && !nextSnapped) hidden.value = layer;
    else under.value = base;
    active.value = layer;
    progress.value = withTiming(step === 1 ? 1 : 0, { duration: TURN_MS, easing: TURN_EASING }, (done) => {
      if (done) runOnJS(commit)(step);
    });
  };

  // Tap on the right / left half; past the last (or before the first) story closes the viewer.
  const turn = (step: 1 | -1) => {
    if (!(step === 1 ? hasNext : hasPrev)) return close();
    if (mode.value !== 0) return;
    if (step === 1 ? canForward : canBack) runOnUI(startTurn)(step, step === 1 ? currentId : prevId, step === 1 ? nextId : currentId, 0.08);
    else commit(step);
  };

  const tilt = (y0: number, y: number) => {
    'worklet';
    // Grabbing low lifts the bottom corner first; moving the finger up or down tilts the fold further.
    const a = ((y0 - height / 2) / height) * 0.45 + ((y - y0) / height) * 0.5;
    return Math.max(-0.3, Math.min(0.3, a));
  };

  const pick = (dx: number, y: number) => {
    'worklet';
    if (dx < 0) {
      if (canForward) {
        mode.value = 1;
        angle.value = tilt(y, y);
        progress.value = 0;
        if (nextSnapped) under.value = nextId;
        else hidden.value = currentId;
        active.value = currentId;
      } else mode.value = hasNext ? 3 : 2;
    } else if (canBack) {
      mode.value = -1;
      angle.value = tilt(y, y);
      progress.value = 1;
      under.value = currentId;
      active.value = prevId;
    } else if (hasPrev) mode.value = -3;
    else owner.value = 0; // nothing before the first story
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onStart((e) => {
      owner.value = mode.value === 0 ? 1 : 0;
      startY.value = e.y;
    })
    .onUpdate((e) => {
      if (!owner.value) return;
      // Direction is picked on the first move: Android reports translationX 0 in onStart.
      if (mode.value === 0) {
        if (e.translationX === 0) return;
        pick(e.translationX, e.y);
      }
      angle.value = tilt(startY.value, e.y);
      if (mode.value === 1) progress.value = Math.max(0, Math.min(1, -e.translationX / width));
      else if (mode.value === -1) progress.value = Math.max(0, Math.min(1, 1 - e.translationX / width));
    })
    .onEnd((e) => {
      if (!owner.value) return;
      owner.value = 0;
      const m = mode.value;
      const v = e.velocityX;
      if (m === 1 || m === -1) {
        const p = progress.value;
        const done = m === 1 ? (p > 0.35 && v < 300) || v < -600 : (p < 0.65 && v > -300) || v > 600;
        const target = done === (m === 1) ? 1 : 0;
        progress.value = withTiming(target, { duration: 180 + 320 * Math.abs(target - p), easing: RELEASE_EASING }, (fin) => {
          if (!fin) return;
          if (done) runOnJS(commit)(m);
          else {
            active.value = '';
            under.value = '';
            hidden.value = '';
            mode.value = 0;
          }
        });
        return;
      }
      mode.value = 0;
      if (Math.abs(e.translationX) < width * 0.25 && Math.abs(v) < 600) return;
      if (m === 2) runOnJS(close)();
      else if (m === 3 || m === -3) runOnJS(commit)(m / 3);
    });

  const dismiss = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetX([-14, 14])
    .onUpdate((e) => {
      if (mode.value !== 0) return;
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (mode.value !== 0) return;
      if (dragY.value > 110 || e.velocityY > 800) runOnJS(close)();
      else dragY.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
    });
  // Sideways turns the page, down closes; whichever moves first wins.
  const gestures = Gesture.Race(pan, dismiss);

  const pages = (settled ? [prev, next, story] : [story]).filter((s): s is Story => !!s);
  const layers = pages.filter((s) => !!snaps[s.id]).map((s) => ({ id: s.id, image: snaps[s.id] }));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View collapsable={false} style={[styles.frame, frameStyle]}>
      <Animated.View collapsable={false} style={[{ width, height }, innerStyle]}>
      <GestureDetector gesture={gestures}>
        {/* Not flattened on Android, or the pan has no view to attach to. */}
        <View collapsable={false} style={StyleSheet.absoluteFill}>
          {pages.map((s) => (
            <StoryPage key={s.id} story={s} top={s.id === story.id} snapshot={settled} hidden={hidden} progress={progress} barH={barH} onTap={turn} onSnapshot={onSnapshot} />
          ))}
          {/* Inside the gesture view: on Android the gesture handler hit-tests views itself and stops at the
              first leaf view under the finger (the canvas), so a canvas above it would swallow the swipe. */}
          {settled ? <PageCurlCanvas layers={layers} active={active} under={under} progress={progress} angle={angle} width={width} height={height} /> : null}
        </View>
      </GestureDetector>

      <PressableScale onPress={close} hitSlop={14} accessibilityLabel="Close" style={[styles.back, { top: insets.top + 13 }]}>
        <Icon name="storyBack" width={15.7} height={27.06} />
      </PressableScale>

      <KeyboardStickyView style={[styles.bar, { height: barH }]} offset={{ closed: 0, opened: barH - 63 }}>
        <View style={styles.pill}>
          <TextInput placeholder="Send message..." placeholderTextColor="#FFFFFF" style={styles.input} selectionColor="#FFFFFF" cursorColor="#FFFFFF" />
        </View>
        <PressableScale haptic hitSlop={10} accessibilityLabel="Like story" style={styles.heart}>
          <Icon name="storyHeart" width={27} height={24} />
        </PressableScale>
      </KeyboardStickyView>
      </Animated.View>
      </Animated.View>
    </View>
  );
}

type PageProps = {
  story: Story;
  /** The visible page; the ones under it only wait to be turned to. */
  top: boolean;
  hidden: SharedValue<string>;
  progress: SharedValue<number>;
  barH: number;
  onTap: (step: 1 | -1) => void;
  onSnapshot: (storyId: string, image: Snapshot) => void;
  /** Snapshots allowed (the viewer has finished opening). */
  snapshot: boolean;
};

// Pictures use the core Image: the snapshot draws the view tree in software on Android, and expo-image's
// hardware bitmaps can't be drawn there.
function StoryPage({ story, top, snapshot, hidden, progress, barH, onTap, onSnapshot }: PageProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const ref = useRef<View>(null);
  const [expanded, setExpanded] = useState(false);
  const [cut, setCut] = useState<string | null>(null);
  // "...more": the caption box grows line by line and, anchored at the bottom, lifts the author and the text up.
  const [lines, setLines] = useState(0);
  const [showFull, setShowFull] = useState(false);
  const [settled, setSettled] = useState(0); // re-snapshot once the caption has finished moving
  const open = useSharedValue(0);
  const onCaptionSettled = useCallback((isOpen: boolean) => {
    if (!isOpen) setShowFull(false);
    setSettled((n) => n + 1);
  }, []);
  const toggleCaption = () => {
    if (cut === null) return; // fits in two lines
    const next = !expanded;
    setExpanded(next);
    if (next) setShowFull(true);
    open.value = withTiming(next ? 1 : 0, { duration: CAPTION_MS, easing: Easing.out(Easing.cubic) }, (fin) => {
      if (fin) runOnJS(onCaptionSettled)(next);
    });
  };
  const captionStyle = useAnimatedStyle(() => {
    if (!lines) return {};
    const shut = Math.min(lines, 2);
    return { height: CAPTION_LH * (shut + (lines - shut) * open.value) + CAPTION_SLACK };
  });
  const [photoReady, setPhotoReady] = useState(false);
  const [avatarReady, setAvatarReady] = useState(!story.author.avatar);
  // Snapshot anyway if a picture never reports onLoad (seen on Android for pages under the top one).
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 800);
    return () => clearTimeout(t);
  }, []);

  const src = Image.resolveAssetSource(story.image as number);
  const photoH = Math.min(MAX_H, src ? (width * src.height) / src.width : MAX_H);
  const photoTop = insets.top + (385 - 47) - photoH / 2;

  // Snapshot for the page turn once the pictures are on screen, and again after the caption opens or closes.
  const ready = (photoReady && avatarReady) || timedOut;
  useEffect(() => {
    if (!CURL_SUPPORTED || !ready || !snapshot) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const take = (attempt: number) =>
      snapshotView(ref).then((image) => {
        if (!image) {
          if (attempt === 0 && !cancelled) retry = setTimeout(() => take(1), 400);
          return;
        }
        if (cancelled) disposeSnapshot(image);
        else onSnapshot(story.id, image);
      });
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => take(0));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(retry);
    };
  }, [ready, snapshot, settled, cut, story.id, onSnapshot]);

  const hideStyle = useAnimatedStyle(() => ({ opacity: hidden.value === story.id && progress.value > 0.03 ? 0 : 1 }));

  return (
    <Animated.View
      ref={ref}
      collapsable={false}
      pointerEvents={top ? 'auto' : 'none'}
      accessibilityElementsHidden={!top}
      importantForAccessibility={top ? 'auto' : 'no-hide-descendants'}
      style={[styles.page, hideStyle]}>
      <Image
        source={story.image}
        fadeDuration={0}
        onLoad={() => setPhotoReady(true)}
        resizeMode="cover"
        style={{ position: 'absolute', top: photoTop, width, height: photoH }}
      />
      <Pressable style={[styles.half, { left: 0, width: width / 2, height }]} onPress={() => onTap(-1)} accessibilityLabel="Previous story" />
      <Pressable style={[styles.half, { left: width / 2, width: width / 2, height }]} onPress={() => onTap(1)} accessibilityLabel="Next story" />

      <View style={[styles.info, { bottom: barH }]} pointerEvents="box-none">
        <View style={styles.author}>
          {story.author.avatar ? (
            <Image source={story.author.avatar} fadeDuration={0} onLoad={() => setAvatarReady(true)} style={styles.avatar} />
          ) : (
            <AuthorAvatar author={story.author} size={28} />
          )}
          <View style={styles.names}>
            <Text style={styles.name}>{story.author.username}</Text>
            <Text style={styles.time}>{story.timeAgo}</Text>
          </View>
        </View>
        <Pressable onPress={toggleCaption}>
          {/* Collapsed: two lines ending in "...more" (Frame 1049). The full text is laid out invisibly to find
              where the second line ends. */}
          <Text
            style={[styles.caption, styles.measure]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onTextLayout={(e) => {
              const l = e.nativeEvent.lines;
              const next = l.length > 2 ? (l[0].text + l[1].text).slice(0, -MORE_CHARS).trimEnd() : null;
              setCut((c) => (c === next ? c : next));
              setLines(l.length);
            }}>
            {story.caption}
          </Text>
          <Animated.View collapsable={false} style={[styles.captionBox, captionStyle]}>
            <Text style={styles.captionText} numberOfLines={showFull ? undefined : 2}>
              {showFull || cut === null ? (
                story.caption
              ) : (
                <>
                  {cut}...<Text style={styles.more}>more</Text>
                </>
              )}
            </Text>
          </Animated.View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Transparent: Home shows around the window while it opens, closes or is dragged.
  root: { flex: 1 },
  frame: { position: 'absolute', overflow: 'hidden', backgroundColor: '#000000' },
  page: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000' },
  half: { position: 'absolute', top: 0 },
  back: { position: 'absolute', left: 15.775 },
  info: { position: 'absolute', left: 14, right: 54 },
  // avatar 28; name 14/600 baseline +12, time 12 baseline +25.2; caption line 18.9 under the avatar
  author: { flexDirection: 'row', height: 28 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  names: { marginLeft: 12.5, marginTop: -1.5 },
  name: { fontSize: 14, lineHeight: 17, fontWeight: '600', color: '#FFFFFF' },
  time: { marginTop: -1.7, marginLeft: 1.3, fontSize: 12, lineHeight: 14, color: MUTED },
  caption: { marginTop: 18.9, marginBottom: 14.1, fontSize: 12.65, lineHeight: 15.65, color: '#FFFFFF' },
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  // Same box as `caption`; the slack below the last line keeps descenders from being clipped while it animates.
  captionBox: { marginTop: 18.9, marginBottom: 14.1 - CAPTION_SLACK, overflow: 'hidden' },
  captionText: { fontSize: 12.65, lineHeight: CAPTION_LH, color: '#FFFFFF' },
  more: { color: MUTED },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: BAR },
  // Frame 1081: 286x41 #181C1F pill (no stroke) at x 14, 12 under the bar top; text at x 36.2
  pill: {
    position: 'absolute',
    left: 14,
    top: 12,
    width: 286,
    height: 41,
    borderRadius: 20.5,
    backgroundColor: '#181C1F',
    justifyContent: 'center',
    paddingLeft: 22.2,
    paddingRight: 16,
  },
  input: { fontSize: 13, color: '#FFFFFF', padding: 0 },
  heart: { position: 'absolute', left: 329, top: 19.75 },
});
