import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Alert, BackHandler, Image, Keyboard, Pressable, StyleSheet, useWindowDimensions, View, ScrollView, type HostInstance, type ImageSource as RNImageSource } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { Easing, Extrapolation, interpolateColor, FadeIn, FadeOut, interpolate, runOnJS, runOnUI, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { CURL_SUPPORTED, disposeSnapshot, snapshotView, type Snapshot } from '@/components/page-curl';
import { PopIcon } from '@/components/pop-icon';
import { PressableScale } from '@/components/pressable-scale';
import { Text, TextInput, INTER_FAMILIES } from '@/components/text';
import { backWhenReady } from '@/lib/nav';
import { storiesClosing, storyOrigin } from '@/lib/story-origin';
import type { Story } from '@/mock/data';
import { replyToStory } from '@/lib/stories';
import { useFeed, useSeenStories } from '@/state/feed';

// Autolayouted (design status bar 47, home indicator 34). Photo centred on design y 390, up to 540 tall; author
// row 92 and caption 46 above the bottom bar; bar 50 + indicator, #0D1015.
const BAR = '#0D1015';
const MUTED = '#999999';
const MAX_H = 540;

/** The viewer's photo box: full width, up to MAX_H tall, centred on design y 390 (cover-cropped when taller). */
function photoHeight(story: Story, width: number) {
  // resolveAssetSource is native-only (react-native-web lacks it)
  const src = Image.resolveAssetSource?.(story.image as number);
  // a photo from the server has no size here: the full box (the photo covers it)
  return Math.min(MAX_H, src?.width && src.height ? (width * src.height) / src.width : MAX_H);
}

// Page turn between stories (not in the design): swipe or tap the right/left half. The previous, current and
// next pages are mounted on top of each other (current on top) and snapshotted. During a turn the curl canvas
// paints the whole frame over the live pages: the current snapshot turning away over the next one, or the
// previous one coming back over the current one; when the turn is done the live page under it is the same.
const TURN_EASING = Easing.out(Easing.cubic);
const RELEASE_EASING = Easing.out(Easing.cubic);
const TURN_MS = 420;
// How long an early tap waits for the page snapshots before switching without the curl.
const PENDING_MS = 450;
const AVATAR_PLACEHOLDER = require('@/assets/icons/avatar-placeholder.png');
// Characters taken off the second caption line to make room for "...more".
const MORE_CHARS = 8;
const CAPTION_LH = 15.65;
const CAPTION_SLACK = 3;
// Autolayouted-7 / -8: the card the photo shrinks into, at (104.5, 48)
const CARD_W = 178;
const CARD_H = 247;
const CAPTION_MS = 320;
// Open / close (not in the design): the viewer grows out of the story's photo on Home and shrinks back into it.
const OPEN_MS = 420;
const CLOSE_MS = 340;
const OPEN_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
const CLOSE_EASING = Easing.bezier(0.4, 0, 0.2, 1);
// Below this t the window hands over to a true circle (see ringStyle); RING_BASE is that circle's unscaled size.
const RING_HANDOFF = 0.22;
const RING_BASE = 100;

// Own gesture root: the viewer is a native modal (transparentModal), which on iOS sits outside the app's root view.
export default function StoryViewerScreen() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StoryViewer />
    </GestureHandlerRootView>
  );
}

function StoryViewer() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { stories, openedStory } = useFeed();
  // The list as it was when the viewer opened: a refresh behind it must not shift the pages.
  const [HOME_STORIES] = useState(stories);
  const [index, setIndex] = useState(() => Math.max(0, HOME_STORIES.findIndex((s) => s.id === id)));
  const story = HOME_STORIES[index];
  const prev: Story | undefined = HOME_STORIES[index - 1];
  const next: Story | undefined = HOME_STORIES[index + 1];
  const barH = 48 + Math.max(insets.bottom, 12); // TH(2): the bar starts 2 lower (762)

  // Open / close. `t`: 0 = the window is the story photo on Home (origin), 1 = full screen. The window clips the
  // viewer; inside it the viewer is scaled so its photo fills the circle, centred, at t 0. Swiping down drags the
  // window and shrinks it; letting go far enough closes into the current story's photo on Home (or fades out when
  // Home didn't report where that is).
  const [origin0] = useState(() => storyOrigin(id ?? ''));
  const t = useSharedValue(origin0 ? 0 : 1);
  const fade = useSharedValue(0);
  const dragY = useSharedValue(0);
  const ox = useSharedValue(origin0?.x ?? 0);
  const oy = useSharedValue(origin0?.y ?? 0);
  const os = useSharedValue(origin0?.size ?? width);
  // Height of the photo box of the story the window opens from / closes into (see photoHeight).
  const ph = useSharedValue(photoHeight(HOME_STORIES[index], width));
  // Only the opened page is mounted while the window grows; the pages next to it, the curl canvas and the
  // snapshots (a full software redraw of the page on Android) come once it's done, so nothing competes with it.
  const [settled, setSettled] = useState(false);
  // The window stays invisible (the photo on Home shows through) until the opened story's photo is loaded, so it
  // never grows as an empty black circle; a short wait is the fallback.
  const [photoShown, setPhotoShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPhotoShown(true), 250);
    return () => clearTimeout(timer);
  }, []);
  const onTopPhoto = useCallback(() => setPhotoShown(true), []);
  useEffect(() => {
    const done = (fin?: boolean) => {
      'worklet';
      if (fin) runOnJS(setSettled)(true);
    };
    if (!photoShown) return;
    if (origin0) {
      fade.set(1);
      t.set(withTiming(1, { duration: OPEN_MS, easing: OPEN_EASING }, done));
    } else fade.set(withTiming(1, { duration: 200 }, done));
  }, [photoShown, origin0, t, fade]);

  // Every story shown here counts as watched (grey ring on Home). Recorded when the viewer closes, not while it
  // opens: marking re-renders the stories row under it.
  const { markStoriesSeen } = useSeenStories();
  const watched = useRef(new Set<string>());
  // Server stories: the caption arrives with the "viewed" call.
  const [captions, setCaptions] = useState<Record<string, string>>({});
  useEffect(() => {
    if (watched.current.has(story.id)) return;
    watched.current.add(story.id);
    if (story.remote) openedStory(story.id).then((c) => c && setCaptions((m) => ({ ...m, [story.id]: c })));
  }, [story.id, story.remote, openedStory]);
  useEffect(() => () => markStoriesSeen([...watched.current]), [markStoriesSeen]);

  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    // Only the closing event here (Home starts the grey sweep from it); the seen state is saved on unmount:
    // updating it now re-rendered this whole screen right as the close animation started (a stutter).
    storiesClosing([...watched.current]);
    const o = storyOrigin(story.id);
    if (o) {
      runOnUI((x: number, y: number, size: number, h: number) => {
        'worklet';
        ox.set(x);
        oy.set(y);
        os.set(size);
        ph.set(h);
        dragY.set(withTiming(0, { duration: CLOSE_MS, easing: CLOSE_EASING }));
        t.set(withTiming(0, { duration: CLOSE_MS, easing: CLOSE_EASING }, (fin) => {
          if (fin) runOnJS(backWhenReady)();
        }));
      })(o.x, o.y, o.size, photoHeight(story, width));
    } else {
      fade.set(withTiming(0, { duration: 200 }, (fin) => {
        if (fin) runOnJS(backWhenReady)();
      }));
    }
  }, [story, width, ox, oy, os, ph, dragY, t, fade]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const photoCY = insets.top + (390 - 47);
  // Transforms only (plus radius and opacity), so the window and the viewer inside it move in the same UI-thread
  // update: the window is a fixed full-screen box scaled to the current rect, the viewer inside is counter-scaled
  // so it stays undistorted, scaled `sc` overall, with its photo centre where it should be.
  const frameStyle = useAnimatedStyle(() => {
    const k = t.get();
    const d = os.get();
    const w = d + (width - d) * k;
    const h = d + (height - d) * k;
    const sx = w / width;
    const sy = h / height;
    const drag = Math.max(0, dragY.get());
    const ds = 1 - Math.min(drag / height, 1) * 0.35;
    return {
      // Near the ring the round copy below takes over (a scaled window can't keep its corners round).
      opacity: fade.get() * interpolate(k, [0, RING_HANDOFF], [0, 1], Extrapolation.CLAMP),
      borderRadius: ((d / 2) * (1 - k) + Math.min(drag * 0.15, 22)) / (((sx + sy) / 2) * ds),
      transform: [
        { translateX: ox.get() * (1 - k) + w / 2 - width / 2 },
        { translateY: oy.get() * (1 - k) + h / 2 - height / 2 + drag * 0.9 },
        { scaleX: sx * ds },
        { scaleY: sy * ds },
      ],
    };
  });
  // Round copy of the ring's picture over the window's last stretch: scaled uniformly, so it is a true circle the
  // whole way, cross-fading with the (rounded-rect) window as it lands on the ring or leaves it.
  const ringStyle = useAnimatedStyle(() => {
    const k = t.get();
    const d = os.get();
    const w = d + (width - d) * k;
    const h = d + (height - d) * k;
    const drag = Math.max(0, dragY.get());
    const ds = 1 - Math.min(drag / height, 1) * 0.35;
    const cx = ox.get() * (1 - k) + w / 2;
    const cy = oy.get() * (1 - k) + h / 2 + drag * 0.9;
    return {
      opacity: fade.get() * interpolate(k, [0, RING_HANDOFF], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: cx - RING_BASE / 2 }, { translateY: cy - RING_BASE / 2 }, { scale: (Math.min(w, h) * ds) / RING_BASE }],
    };
  });
  // Keeps the viewer's photo centre (width / 2, photoCY) on the window's centre at t 0 and in place at t 1.
  const innerStyle = useAnimatedStyle(() => {
    const k = t.get();
    const d = os.get();
    // At t 0 the photo covers the circle like the ring's own picture (cropped, not letterboxed).
    const sc0 = d / Math.min(width, ph.get());
    const sc = sc0 + (1 - sc0) * k;
    const w = d + (width - d) * k;
    const h = d + (height - d) * k;
    const sx = w / width;
    const sy = h / height;
    const ty = d / 2 + (photoCY - d / 2) * k; // photo centre from the window top
    return {
      transform: [{ translateY: (ty - h / 2 - sc * (photoCY - height / 2)) / sy }, { scaleX: sc / sx }, { scaleY: sc / sy }],
    };
  });


  const [snaps, setSnaps] = useState<Record<string, Snapshot>>({});
  const onSnapshot = useCallback((storyId: string, image: Snapshot) => {
    // Closing: no re-render of the pages and canvas mid-animation for a snapshot nobody will turn.
    if (closing.current) {
      disposeSnapshot(image);
      return;
    }
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
  // Index of the story in front, kept on the UI thread so the cube stays put while React catches up after a turn.
  const idx = useSharedValue(index);
  const settle = (step: number) => {
    'worklet';
    idx.set(idx.get() + step);
    mode.set(0);
    progress.set(0);
  };
  // Switches that don't go through the cube (before the pages are mounted) move it along too.
  useEffect(() => {
    if (mode.get() === 0) idx.set(index);
  }, [index, idx, mode]);

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
          active.set('');
          under.set('');
          hidden.set('');
          progress.set(0);
          mode.set(0);
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
  }, [index, active, under, hidden, progress, mode, HOME_STORIES]);

  // The cube turns live pages: no snapshots needed, only the neighbours mounted.
  const canForward = settled && !!next;
  const nextSnapped = true;
  const canBack = settled && !!prev;
  const currentId = story.id;
  const prevId = prev?.id ?? '';
  const nextId = next?.id ?? '';

  const hasNext = !!next;
  const hasPrev = !!prev;

  const startTurn = (step: number, layer: string, base: string, tilt: number) => {
    'worklet';
    mode.set(step);
    angle.set(tilt);
    progress.set(step === 1 ? 0 : 1);
    if (step === 1 && !nextSnapped) hidden.set(layer);
    else under.set(base);
    active.set(layer);
    progress.set(withTiming(step === 1 ? 1 : 0, { duration: TURN_MS, easing: TURN_EASING }, (done) => {
      if (!done) return;
      settle(step);
      runOnJS(commit)(step);
    }));
  };

  // A tap that comes before the pages are snapshotted (right after opening, or right after a turn) waits for the
  // snapshot a moment so it still turns with the curl; if it doesn't come in time the story just switches.
  const pending = useRef<{ step: 1 | -1; timer: ReturnType<typeof setTimeout> } | null>(null);
  useEffect(() => {
    const p = pending.current;
    if (!p || !(p.step === 1 ? canForward : canBack) || mode.get() !== 0) return;
    clearTimeout(p.timer);
    pending.current = null;
    runOnUI(startTurn)(p.step, p.step === 1 ? currentId : prevId, p.step === 1 ? nextId : currentId, 0.08);
  });
  useEffect(() => () => clearTimeout(pending.current?.timer), []);

  // Tap on the right / left half; past the last (or before the first) story closes the viewer.
  const turn = (step: 1 | -1) => {
    if (!(step === 1 ? hasNext : hasPrev)) return close();
    if (mode.get() !== 0 || pending.current) return;
    if (step === 1 ? canForward : canBack) runOnUI(startTurn)(step, step === 1 ? currentId : prevId, step === 1 ? nextId : currentId, 0.08);
    else if (CURL_SUPPORTED && !closing.current) {
      pending.current = {
        step,
        timer: setTimeout(() => {
          pending.current = null;
          if (mode.get() === 0) commit(step);
        }, PENDING_MS),
      };
    } else commit(step);
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
        mode.set(1);
        angle.set(tilt(y, y));
        progress.set(0);
        if (nextSnapped) under.set(nextId);
        else hidden.set(currentId);
        active.set(currentId);
      } else mode.set(hasNext ? 3 : 2);
    } else if (canBack) {
      mode.set(-1);
      angle.set(tilt(y, y));
      progress.set(1);
      under.set(currentId);
      active.set(prevId);
    } else if (hasPrev) mode.set(-3);
    else owner.set(0); // nothing before the first story
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onStart((e) => {
      owner.set(mode.get() === 0 ? 1 : 0);
      startY.set(e.y);
    })
    .onUpdate((e) => {
      if (!owner.get()) return;
      // Direction is picked on the first move: Android reports translationX 0 in onStart.
      if (mode.get() === 0) {
        if (e.translationX === 0) return;
        pick(e.translationX, e.y);
      }
      angle.set(tilt(startY.get(), e.y));
      if (mode.get() === 1) progress.set(Math.max(0, Math.min(1, -e.translationX / width)));
      else if (mode.get() === -1) progress.set(Math.max(0, Math.min(1, 1 - e.translationX / width)));
    })
    // eslint-disable-next-line react-hooks/refs -- gesture callbacks run on gesture events, not during render
    .onEnd((e) => {
      if (!owner.get()) return;
      owner.set(0);
      const m = mode.get();
      const v = e.velocityX;
      if (m === 1 || m === -1) {
        const p = progress.get();
        const done = m === 1 ? (p > 0.35 && v < 300) || v < -600 : (p < 0.65 && v > -300) || v > 600;
        const target = done === (m === 1) ? 1 : 0;
        progress.set(withTiming(target, { duration: 180 + 320 * Math.abs(target - p), easing: RELEASE_EASING }, (fin) => {
          if (!fin) return;
          if (done) {
            settle(m);
            runOnJS(commit)(m);
          } else {
            active.set('');
            under.set('');
            hidden.set('');
            mode.set(0);
          }
        }));
        return;
      }
      mode.set(0);
      if (Math.abs(e.translationX) < width * 0.25 && Math.abs(v) < 600) return;
      if (m === 2) runOnJS(close)();
      else if (m === 3 || m === -3) runOnJS(commit)(m / 3);
    });

  const dismiss = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetX([-14, 14])
    .onUpdate((e) => {
      if (mode.get() !== 0) return;
      dragY.set(Math.max(0, e.translationY));
    })
    // eslint-disable-next-line react-hooks/refs -- gesture callbacks run on gesture events, not during render
    .onEnd((e) => {
      if (mode.get() !== 0) return;
      if (dragY.get() > 110 || e.velocityY > 800) runOnJS(close)();
      else dragY.set(withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) }));
    });
  // Sideways turns the page, down closes; whichever moves first wins.
  const gestures = Gesture.Race(pan, dismiss);

  const [replying, setReplying] = useState(false);
  // The field widens from the 286 pill to the typing width (16…W−22) as the keyboard comes up, and back.
  const typing = useSharedValue(0);
  useEffect(() => {
    typing.set(withTiming(replying ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) }));
  }, [replying, typing]);
  const pillGrow = useAnimatedStyle(() => {
    const k = typing.get();
    return {
      left: 14 + 2 * k,
      width: 286 + (width - 38 - 286) * k,
      backgroundColor: interpolateColor(k, [0, 1], ['#181C1F', 'rgba(24,28,31,0)']),
      borderColor: interpolateColor(k, [0, 1], ['rgba(255,255,255,0)', '#FFFFFF']),
    };
  });
  const [reply, setReply] = useState('');
  // Not designed: the reply goes to the author's chat, linked to the story; "Sent" shows for a moment in the field's
  // place. Mock stories (no account behind them) only clear the field.
  const [sent, setSent] = useState(false);
  // Not designed: the heart turns red with a pop; on a server story the first like also sends ❤️ to the author's
  // chat (as a reply to the story). Kept for the session.
  const [likedStories, setLikedStories] = useState<ReadonlySet<string>>(() => new Set());
  const hearted = useRef(new Set<string>());
  const likeStory = () => {
    const on = !likedStories.has(story.id);
    setLikedStories((set) => {
      const next = new Set(set);
      if (on) next.add(story.id);
      else next.delete(story.id);
      return next;
    });
    if (on && story.authorId && !hearted.current.has(story.id)) {
      hearted.current.add(story.id);
      replyToStory(story, '❤️').catch(() => hearted.current.delete(story.id));
    }
  };
  const sendReply = () => {
    const text = reply.trim();
    if (!text) return;
    setReply('');
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!story.authorId) return;
    replyToStory(story, text).then(
      () => {
        setSent(true);
        setTimeout(() => setSent(false), 1500);
      },
      () => {
        setReply(text);
        Alert.alert("Couldn't send", 'Check the connection and try again.');
      },
    );
  };
  const pages = (settled ? [prev, next, story] : [story]).filter((s): s is Story => !!s);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View collapsable={false} style={[styles.frame, { width, height }, frameStyle]}>
      <Animated.View collapsable={false} style={[{ width, height }, innerStyle]}>
      <GestureDetector gesture={gestures}>
        {/* Not flattened on Android, or the pan has no view to attach to. */}
        <View collapsable={false} style={StyleSheet.absoluteFill}>
          {pages.map((s) => (
            <CubeFace key={s.id} at={s === prev ? index - 1 : s === next ? index + 1 : index} idx={idx} mode={mode} progress={progress} width={width}>
              <StoryPage story={captions[s.id] ? { ...s, caption: captions[s.id] } : s} top={s.id === story.id} onPhoto={s.id === story.id ? onTopPhoto : undefined} snapshot={false} closing={closing} hidden={hidden} progress={progress} barH={barH} onTap={turn} onSnapshot={onSnapshot} />
              <StaticBar barH={barH} at={s === prev ? index - 1 : s === next ? index + 1 : index} idx={idx} mode={mode} progress={progress} />
            </CubeFace>
          ))}
        </View>
      </GestureDetector>

      <PressableScale onPress={close} hitSlop={14} accessibilityLabel="Close" style={[styles.close, { top: insets.top + 4 }]}>
        <Icon name="storyClose" width={24} height={24} />
      </PressableScale>

      {/* Typing a reply (Autolayouted-1/-2/-3): the story dims to 80% black, the field turns into a clear pill with a thin
          white border spanning the width, grows upwards with the text and gets a white send button inside. */}
      {replying ? (
        <Animated.View collapsable={false} entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, styles.dim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} accessibilityLabel="Close the reply" />
        </Animated.View>
      ) : null}
      {/* the field and the heart turn with their story (the neighbours carry a still copy) */}
      <CubeFace at={index} idx={idx} mode={mode} progress={progress} width={width} passTouches follow>
      <KeyboardStickyView style={[styles.bar, { height: barH }, replying && styles.barTyping]} offset={{ closed: 0, opened: barH - 65 }}>
        <Animated.View style={[styles.pill, replying && [styles.pillTyping, { bottom: barH - 53 }], pillGrow]}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            onFocus={() => setReplying(true)}
            onBlur={() => setReplying(false)}
            multiline={replying}
            placeholder={sent ? 'Sent' : 'Send message...'}
            placeholderTextColor="#FFFFFF"
            style={[styles.input, replying && styles.inputTyping, replying && reply.trim() ? styles.inputWithSend : null]}
            selectionColor="#FFFFFF"
            cursorColor="#FFFFFF"
            accessibilityLabel="Reply to the story"
          />
          {replying && reply.trim() ? (
            <Animated.View collapsable={false} entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={styles.sendWrap}>
              <PressableScale haptic onPress={sendReply} scaleTo={0.9} hitSlop={6} style={styles.send} accessibilityRole="button" accessibilityLabel="Send">
                <Icon name="chatSend" width={20.2} height={18.2} />
              </PressableScale>
            </Animated.View>
          ) : null}
        </Animated.View>
        {replying ? null : (
          <PressableScale haptic onPress={likeStory} hitSlop={10} accessibilityLabel={likedStories.has(story.id) ? 'Unlike story' : 'Like story'} style={styles.heart}>
            <PopIcon active={likedStories.has(story.id)}>
              {likedStories.has(story.id) ? (
                <Icon name="feedLikeFilled" width={27} height={24} tintColor="#FF3040" />
              ) : (
                <Icon name="storyHeart" width={27} height={24} />
              )}
            </PopIcon>
          </PressableScale>
        )}
      </KeyboardStickyView>
      </CubeFace>
      </Animated.View>
      </Animated.View>
      <Animated.View collapsable={false} pointerEvents="none" style={[styles.ring, ringStyle]}>
        {/* expo-image like the ring itself (same crop); the core Image drew the photo unscaled from its corner here. */}
        <ExpoImage source={story.image} contentFit="cover" style={styles.ringPhoto} />
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
  /** Called once the photo has loaded. */
  onPhoto?: () => void;
  /** Snapshots allowed (the viewer has finished opening). */
  snapshot: boolean;
  /** Set once the viewer starts closing: no more snapshots (each one stalls the UI thread on Android). */
  closing: RefObject<boolean>;
};

// Pictures use the core Image: the snapshot draws the view tree in software on Android, and expo-image's
// hardware bitmaps can't be drawn there.
// Instagram-like cube (not designed): the story in front and the one coming in are two sides of a box turning
// around their shared edge, with perspective and the far side shaded. `p` = the face's place relative to the front
// (−1 … 1); hinged on its left edge when it's to the right and on its right edge when it's to the left.
/** A face's place relative to the one in front (−1 … 1 while turning), read on the UI thread. */
function facePos(at: number, idx: SharedValue<number>, mode: SharedValue<number>, progress: SharedValue<number>) {
  'worklet';
  const m = mode.get();
  return at - (idx.get() + (m === 1 ? progress.get() : m === -1 ? progress.get() - 1 : 0));
}

function CubeFace({ at, idx, mode, progress, width, children, passTouches, follow }: { at: number; idx: SharedValue<number>; mode: SharedValue<number>; progress: SharedValue<number>; width: number; children: ReactNode; passTouches?: boolean; follow?: boolean }) {
  // Reanimated subscribes a style to the shared values read in its own body, so each style reads them directly.
  const face = useAnimatedStyle(() => {
    // `follow`: the one that carries the live reply field stays with the story in front on the UI thread (React's index lags a frame behind a turn)
    const p = facePos(follow ? idx.get() : at, idx, mode, progress);
    // Seen from outside: the faces sit on a cube whose centre is W/2 behind the screen, a face p pages away turned by
    // p·90° about it. Android drops the z move and the off-centre vanishing point of a general matrix, so the seams
    // drifted. Here each face is the same projected quad written as [translateX, perspective, rotateY, scale] (which
    // every platform applies as is): the true edge x and edge heights are computed, then the scale s, the turn φ, the
    // camera distance dc and the shift a that reproduce exactly those four numbers.
    const r = width / 2;
    // weak perspective: a turning face is edge-on (and then hidden) close to the screen edge, ~9 px from it
    const d = width * 10;
    const t = Math.max(-1, Math.min(1, p)) * (Math.PI / 2);
    const c = Math.cos(t);
    const sn = Math.sin(t);
    const tx = r * sn;
    const tz = r * c - r;
    const hR = d / (d - (tz - r * sn));
    const hL = d / (d - (tz + r * sn));
    const xR = (tx + r * c) * hR;
    const xL = (tx - r * c) * hL;
    const s = (2 * hL * hR) / (hL + hR);
    const k = (s * (1 / hR - 1 / hL)) / (2 * r);
    let phi = t;
    let dc = d;
    if (Math.abs(k * r) > 1e-4) {
      phi = Math.sign(k) * Math.acos(Math.min(1, ((xR - xL) * (1 - k * r * k * r)) / (2 * s * r)));
      dc = (s * Math.sin(phi)) / k;
    }
    const a = xR - (s * r * Math.cos(phi)) / (1 + k * r);
    return {
      // past edge-on the face would show its back: gone from there
      opacity: Math.abs(p) >= 0.999 || xR - xL < 0.5 ? 0 : 1,
      transform: [{ translateX: a }, { perspective: dc }, { rotateY: `${phi}rad` }, { scale: s }],
    };
  });
  const shade = useAnimatedStyle(() => {
    // `follow`: the one that carries the live reply field stays with the story in front on the UI thread (React's index lags a frame behind a turn)
    const p = facePos(follow ? idx.get() : at, idx, mode, progress);
    return { opacity: Math.min(1, Math.abs(p)) * 0.55 };
  });
  return (
    <Animated.View collapsable={false} pointerEvents={passTouches ? 'box-none' : undefined} style={[StyleSheet.absoluteFill, face]}>
      {children}
      <Animated.View collapsable={false} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cubeShade, shade]} />
    </Animated.View>
  );
}

/** The reply field and heart of a story that is not in front: the same look, not interactive. */
function StaticBar({ barH, at, idx, mode, progress }: { barH: number; at: number; idx: SharedValue<number>; mode: SharedValue<number>; progress: SharedValue<number> }) {
  // in front, the live field is drawn instead: this one must not show under (or flash beside) it
  const style = useAnimatedStyle(() => ({ opacity: Math.abs(facePos(at, idx, mode, progress)) < 0.002 ? 0 : 1 }));
  return (
    <Animated.View collapsable={false} pointerEvents="none" style={[styles.bar, { height: barH }, style]}>
      <View style={styles.pill}>
        <Text style={styles.input}>Send message...</Text>
      </View>
      <View style={styles.heart}>
        <Icon name="storyHeart" width={27} height={24} />
      </View>
    </Animated.View>
  );
}

function StoryPage({ story, top, snapshot, closing, hidden, progress, barH, onTap, onSnapshot, onPhoto }: PageProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const ref = useRef<HostInstance>(null);
  const [expanded, setExpanded] = useState(false);
  const [cut, setCut] = useState<string | null>(null);
  // "...more" (Autolayouted-7 / -8): the photo shrinks into a card at the top and a dark sheet with the whole
  // caption rises from the bottom; tapping the card or the handle puts it back.
  const open = useSharedValue(0);
  const sheetTopRef = insets.top + (305 - 47);
  const toggleCaption = () => {
    if (cut === null && !expanded) return; // fits in two lines
    const next = !expanded;
    setExpanded(next);
    // opening springs (clamped: the sheet must not lift off the bottom), closing eases out
    const done = (fin?: boolean) => {
      'worklet';
      if (fin) runOnJS(setSettled)((n: number) => n + 1);
    };
    open.set(next ? withSpring(1, { damping: 22, stiffness: 210, overshootClamping: true }, done) : withTiming(0, { duration: CAPTION_MS, easing: Easing.out(Easing.cubic) }, done));
  };
  // The sheet follows a downward drag; let go past a quarter (or flick) and it closes.
  const sheetPan = Gesture.Pan()
    .activeOffsetY(6)
    .failOffsetX([-14, 14])
    .onUpdate((e) => {
      open.set(Math.min(1, Math.max(0, 1 - e.translationY / Math.max(1, height - sheetTopRef))));
    })
    .onEnd((e) => {
      if (open.get() < 0.75 || e.velocityY > 800) {
        open.set(withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }));
        runOnJS(setExpanded)(false);
      } else open.set(withSpring(1, { damping: 22, stiffness: 210 }));
    });
  const [settled, setSettled] = useState(0); // re-snapshot once the sheet has finished moving
  const [photoReady, setPhotoReady] = useState(false);
  const [avatarReady, setAvatarReady] = useState(!story.author.avatar);
  // Snapshot anyway if a picture never reports onLoad (seen on Android for pages under the top one).
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 800);
    return () => clearTimeout(t);
  }, []);

  const photoH = photoHeight(story, width);
  const photoTop = insets.top + (390 - 47) - photoH / 2;
  const cardTop = insets.top + 1;
  const sheetTop = sheetTopRef;
  // the full-screen photo flies into the card: uniform scale on its centre, then the card takes over
  const photoStyle = useAnimatedStyle(() => {
    const k = open.get();
    const s = 1 + (CARD_W / width - 1) * k;
    const dy = (cardTop + CARD_H / 2 - (photoTop + photoH / 2)) * k;
    return { opacity: 1 - interpolate(k, [0.7, 1], [0, 1], Extrapolation.CLAMP), transform: [{ translateY: dy }, { scale: s }] };
  });
  const cardStyle = useAnimatedStyle(() => ({ opacity: interpolate(open.get(), [0.6, 1], [0, 1], Extrapolation.CLAMP) }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (height - sheetTop) * (1 - open.get()) }] }));
  const infoStyle = useAnimatedStyle(() => ({ opacity: 1 - open.get() }));

  // Snapshot for the page turn once the pictures are on screen, and again after the caption opens or closes.
  const ready = (photoReady && avatarReady) || timedOut;
  useEffect(() => {
    if (!CURL_SUPPORTED || !ready || !snapshot) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const take = (attempt: number) => {
      if (closing.current) return;
      return snapshotView(ref).then((image) => {
        if (!image) {
          if (attempt === 0 && !cancelled) retry = setTimeout(() => take(1), 400);
          return;
        }
        if (cancelled) disposeSnapshot(image);
        else onSnapshot(story.id, image);
      });
    };
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => take(0));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(retry);
    };
  }, [ready, snapshot, closing, settled, cut, story.id, onSnapshot]);

  const hideStyle = useAnimatedStyle(() => ({ opacity: hidden.get() === story.id && progress.get() > 0.03 ? 0 : 1 }));

  return (
    <Animated.View
      ref={ref}
      collapsable={false}
      pointerEvents={top ? 'auto' : 'none'}
      accessibilityElementsHidden={!top}
      importantForAccessibility={top ? 'auto' : 'no-hide-descendants'}
      style={[styles.page, hideStyle]}>
      <Animated.View style={[{ position: 'absolute', top: photoTop, width, height: photoH }, photoStyle]}>
        <Image
          source={story.image as RNImageSource}
          fadeDuration={0}
          onLoad={() => {
            setPhotoReady(true);
            onPhoto?.();
          }}
          resizeMode="cover"
          style={{ width, height: photoH }}
        />
      </Animated.View>
      <Pressable style={[styles.half, { left: 0, width: width / 2, height }]} onPress={() => onTap(-1)} accessibilityLabel="Previous story" />
      <Pressable style={[styles.half, { left: width / 2, width: width / 2, height }]} onPress={() => onTap(1)} accessibilityLabel="Next story" />

      <Animated.View style={[styles.info, { bottom: barH + 2 }, infoStyle]} pointerEvents={expanded ? 'none' : 'box-none'}>
        <View style={styles.author}>
          {story.author.avatar ? (
            <Image source={story.author.avatar as RNImageSource} fadeDuration={0} onLoad={() => setAvatarReady(true)} style={styles.avatar} />
          ) : (
            // The placeholder through the core Image too: drawn by expo-image (a hardware bitmap) it was missing from the Android snapshot.
            <Image source={AVATAR_PLACEHOLDER} fadeDuration={0} style={styles.avatar} />
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
            }}>
            {story.caption}
          </Text>
          <View style={styles.captionBox}>
            <Text style={styles.captionText} numberOfLines={2}>
              {cut === null ? (
                story.caption
              ) : (
                <>
                  {cut}...<Text style={styles.more}>more</Text>
                </>
              )}
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* the open caption: card + sheet; a tap anywhere else closes it instead of turning the story */}
      {expanded ? <Pressable style={StyleSheet.absoluteFill} onPress={toggleCaption} accessibilityLabel="Close caption" /> : null}
      <Animated.View pointerEvents={expanded ? 'auto' : 'none'} style={[styles.card, { top: cardTop }, cardStyle]}>
        <Pressable onPress={toggleCaption} style={StyleSheet.absoluteFill} accessibilityLabel="Close caption">
          <Image source={story.image as RNImageSource} fadeDuration={0} resizeMode="contain" style={styles.cardPhoto} />
        </Pressable>
      </Animated.View>
      <GestureDetector gesture={sheetPan}>
      <Animated.View pointerEvents={expanded ? 'auto' : 'none'} style={[styles.sheet, { top: sheetTop }, sheetStyle]}>
        <Pressable onPress={toggleCaption} hitSlop={12} style={styles.handleHit} accessibilityLabel="Close caption">
          <View style={styles.handle} />
        </Pressable>
        <View style={styles.sheetAuthor}>
          <Image source={story.author.avatar ?? AVATAR_PLACEHOLDER} fadeDuration={0} style={styles.sheetAvatar} />
          <Text style={styles.sheetName}>{story.author.username}</Text>
        </View>
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sheetText}>{story.caption}</Text>
        </ScrollView>
        <Text style={[styles.sheetTime, { marginBottom: Math.max(insets.bottom - 7.6, 12) + 19.5 }]}>{story.timeAgo}</Text>
      </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cubeShade: { backgroundColor: '#000000' },
  // Transparent: Home shows around the window while it opens, closes or is dragged.
  root: { flex: 1 },
  frame: { position: 'absolute', left: 0, top: 0, overflow: 'hidden', backgroundColor: '#000000' },
  ring: { position: 'absolute', left: 0, top: 0, width: RING_BASE, height: RING_BASE, borderRadius: RING_BASE / 2, overflow: 'hidden' },
  ringPhoto: { width: RING_BASE, height: RING_BASE },
  page: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000' },
  half: { position: 'absolute', top: 0 },
  // ✕ (22 + its 2px stroke) at x 349, y 4 under the status bar.
  close: { position: 'absolute', right: 17 },
  info: { position: 'absolute', left: 13, right: 54 },
  // avatar 28; name 14/600 baseline +12, time 12 baseline +25.2; caption line 18.9 under the avatar
  author: { flexDirection: 'row', height: 28 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  names: { marginLeft: 11.7, marginTop: -1.86 },
  name: { fontFamily: INTER_FAMILIES['600'], fontSize: 13.26, lineHeight: 17, color: '#FFFFFF' },
  time: { marginTop: -1.16, marginLeft: 1.3, fontFamily: INTER_FAMILIES['400'], fontSize: 12, lineHeight: 14, color: MUTED },
  caption: { marginTop: 19.9, marginBottom: 13.1, fontFamily: INTER_FAMILIES['400'], fontSize: 12.65, lineHeight: 15.65, color: '#FFFFFF' },
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  // Same box as `caption`; the slack below the last line keeps descenders from being clipped while it animates.
  card: { position: 'absolute', left: 104.5, width: CARD_W, height: CARD_H, borderRadius: 10, overflow: 'hidden', backgroundColor: '#0F1419' },
  cardPhoto: { width: CARD_W, height: CARD_H },
  // sheet #181C1F (r 40) from y 305: handle 53×2 #8E8E93 13 down, avatar 27 at x 18 38 down, name Inter Bold 12.9 white;
  // caption Inter 12.85 / 22 white from 80 down, 20 in; "2h ago" Inter 12.2 #999 at the bottom
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 40, borderTopRightRadius: 40, backgroundColor: '#181C1F' },
  handleHit: { alignSelf: 'center', paddingTop: 13, paddingBottom: 10 },
  handle: { width: 53, height: 2, borderRadius: 1, backgroundColor: '#8E8E93' },
  sheetAuthor: { flexDirection: 'row', alignItems: 'center', marginTop: 1.5, marginLeft: 15 },
  sheetAvatar: { width: 27, height: 27, borderRadius: 13.5 },
  sheetName: { marginLeft: 12.7, fontFamily: INTER_FAMILIES['700'], fontSize: 12.9, lineHeight: 16, color: '#FFFFFF' },
  sheetScroll: { flex: 1, marginTop: 15.2 },
  sheetScrollContent: { paddingLeft: 17.2, paddingRight: 18, paddingBottom: 16 },
  sheetText: { fontFamily: INTER_FAMILIES['400'], fontSize: 12.85, lineHeight: 22, color: '#FFFFFF' },
  sheetTime: { marginLeft: 17.3, fontFamily: INTER_FAMILIES['400'], fontSize: 12.2, lineHeight: 15, color: MUTED },
  captionBox: { marginTop: 18.9, marginBottom: 14.1 - CAPTION_SLACK, overflow: 'hidden' },
  captionText: { fontFamily: INTER_FAMILIES['400'], fontSize: 12.65, lineHeight: CAPTION_LH, color: '#FFFFFF' },
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { fontFamily: INTER_FAMILIES['400'], fontSize: 12.4, color: '#FFFFFF', padding: 0 },
  dim: { backgroundColor: 'rgba(0,0,0,0.8)' },
  barTyping: { backgroundColor: 'transparent' },
  // Field while typing: x 16..368, its bottom 12 above the keyboard, ≥45.75 tall, radius 22.9, thin white border.
  pillTyping: {
    top: undefined,
    height: undefined,
    minHeight: 45.75,
    borderRadius: 22.9,
    justifyContent: 'flex-end',
    paddingLeft: 17,
    paddingRight: 16,
  },
  inputTyping: { fontSize: 15.5, lineHeight: 19.5, maxHeight: 19.5 * 5, paddingTop: 13, paddingBottom: 13 },
  inputWithSend: { marginRight: 50 },
  sendWrap: { position: 'absolute', right: 5, bottom: 5.5 },
  send: { width: 46, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  heart: { position: 'absolute', left: 328, top: 19.75 },
});
