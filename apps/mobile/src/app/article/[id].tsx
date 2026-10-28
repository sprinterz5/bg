import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, Extrapolation, FadeIn, interpolate, runOnJS, runOnUI, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthorAvatar } from '@/components/author-row';
import { Icon, type IconName } from '@/components/icon';
import { LikeButton } from '@/components/like-button';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { PostActions } from '@/components/post-actions';
import { PressableScale } from '@/components/pressable-scale';
import { ShareSheet } from '@/components/share-sheet';
import { titleCase } from '@/lib/title-case';
import { paginateLines } from '@/lib/paginate';
import type { Article } from '@/mock/data';
import { useFeed } from '@/state/feed';
import { colors, fonts } from '@/theme';
import { INTER_FAMILIES, Text } from '@/components/text';
import { articleOrigin, type ArticleOrigin } from '@/lib/article-origin';
import { useReaction } from '@/lib/reactions';
import { CommentsSheet, useAddedComments } from '@/components/comments-sheet';
import { captureParam } from '@/lib/capture';
import { backWhenReady, openProfile } from '@/lib/nav';
import { api } from '@/lib/api';
import type { Picture } from '@/lib/picture';

// Page 1 is the preview (AutoLayouted-18): back · author · ⋯, the title, "N pages", the subtitle, the
// cover and share / bookmark. Swiping on brings in the text pages (AutoLayouted 17): a strip of the cover behind a
// glass author card, ✕ in a grey circle, the serif text and comments / like / share / bookmark at the bottom. The
// text pages' chrome comes in from the right with page 2 while the preview goes out to the left. y below are design
// y − 47 (status bar).
// Text pages (AutoLayouted, page 2): serif ~18.6 on 32.5 lines, x 57 … 355, first line's ink at y ~100.
const LINE_HEIGHT = 32.5;
const TEXT_LEFT = 57;
const TEXT_RIGHT = 35;
// Reading colours (asked for by the designer): white page, #191919 text.
const READER_BG = '#FFFFFF';
const READER_TEXT = '#191919';
// first text line's ink at y ~100 (no cover strip above the text)
const TEXT_TOP = 41.5;
// Open / close (not in the design): the cover grows out of the tapped picture (feed, Explore, profile) into the
// preview's picture and the rest of the reader comes in after it; closing shrinks it back into that picture.
const OPEN_MS = 440;
const CLOSE_MS = 360;
const OPEN_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
const CLOSE_EASING = Easing.bezier(0.4, 0, 0.2, 1);

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { articles, ensureArticle } = useFeed();
  const article = id ? articles[id] : undefined;
  // Posts from the server come without their text: it's fetched here (a white page meanwhile).
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (id && !article) ensureArticle(id).then((ok) => setMissing(!ok));
  }, [id, article, ensureArticle]);
  // An opened server post goes into the Home "History" tab.
  useEffect(() => {
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      api('/feed/events', { body: { events: [{ eventType: 'OPEN', targetType: 'ARTICLE', targetId: id, source: 'reader' }] }, auth: true }).catch(() => {});
    }
  }, [id]);
  if (!article) return missing ? <PlaceholderScreen title="Article not found" showBack /> : <View style={styles.loading} />;
  // Own gesture root: the reader is a native modal (transparentModal), which on iOS sits outside the app's root view,
  // so without it the pages / swipe-down pans never receive touches.
  return (
    <GestureHandlerRootView style={styles.root}>
      <Reader article={article} />
    </GestureHandlerRootView>
  );
}

type Rect = { x: number; y: number; w: number; h: number };

function Reader({ article }: { article: Article }) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollX = useSharedValue(0);

  const [lines, setLines] = useState<string[] | null>(null);
  const [following, setFollowing] = useState(false);
  // shared with the post's feed card (and synced with the server)
  const { liked, saved, likes, toggleLike, toggleSave } = useReaction(article.id, { liked: false, saved: false, likes: article.likes });
  const [sharing, setSharing] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const addedComments = useAddedComments(article.id);
  const [menu, setMenu] = useState(false);

  const top = insets.top;
  const BAR_H = 39 + Math.max(insets.bottom, 12);
  const textWidth = W - TEXT_LEFT - TEXT_RIGHT;
  const pictureW = W - 30;
  const pictureH = (pictureW * 272) / 360;

  const fullText = useMemo(() => article.body.map((p) => `  ${p}`).join('\n\n'), [article.body]);

  const pages = useMemo(() => {
    if (!lines) return null;
    // the text ends ~102 above the bottom (the page number sits under it)
    const room = H - top - TEXT_TOP - (Math.max(insets.bottom, 12) + 68);
    return paginateLines(lines, LINE_HEIGHT, { first: room, rest: room });
  }, [lines, H, insets.bottom, top]);

  // Which page is showing (0 = preview, 1.. text pages): the preview's buttons only take touches while it is.
  // `rise` goes 0 → 1 as the text comes up over the preview (pulled up from the bottom); `scrollX` is the horizontal
  // offset among the text pages. Both are driven by the reader's own pan.
  // design check: `?capture&text=1` opens straight on the first text page
  const [page, setPage] = useState(captureParam('text') ? 1 : 0);
  const rise = useSharedValue(captureParam('text') ? 1 : 0);
  const textCount = pages ? pages.length : 0;
  // Preview → text (not in the design): the preview drifts up and fades while the text rises from below and the
  // rail settles in — all with the finger.
  const previewOut = useAnimatedStyle(() => {
    const p = rise.get();
    return { opacity: interpolate(p, [0, 0.6], [1, 0], Extrapolation.CLAMP), transform: [{ translateY: -H * 0.18 * p }] };
  });
  // The author card slides down from above the screen (no fading: its blur jumps in on iOS when faded); ✕ comes with it.
  const cardIn = useAnimatedStyle(() => {
    const p = interpolate(rise.get(), [0.35, 1], [0, 1], Extrapolation.CLAMP);
    const eased = 1 - (1 - p) * (1 - p) * (1 - p);
    return { transform: [{ translateY: -(top + 90) * (1 - eased) }] };
  });
  // Not designed: while reading, the rail, ✕ and the page count fade out after 3.5 s without a touch; any touch
  // brings them back (the first touch only wakes them, it doesn't press a hidden button).
  const chrome = useSharedValue(1);
  const [chromeOn, setChromeOn] = useState(true);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arm = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    if (page === 0) return;
    idle.current = setTimeout(() => {
      chrome.set(withTiming(0, { duration: 700 }));
      setChromeOn(false);
    }, 3500);
  }, [chrome, page]);
  const wake = () => {
    chrome.set(withTiming(1, { duration: 200 }));
    setChromeOn(true);
    arm();
  };
  // A touch shows hidden controls; a tap while they're shown hides them (not on the rail or ✕ themselves).
  const wasOn = useRef(true);
  const touch = () => {
    wasOn.current = chromeOn;
    if (chromeOn) arm();
    else if (!justHid.current) wake();
  };
  // Hidden at once on the first tap (no wait for a possible second one); the second tap of a double tap (a like)
  // doesn't bring them back.
  const justHid = useRef(false);
  const tapped = (x: number, y: number) => {
    if (page === 0 || !wasOn.current || x < 50 || (y < top + 50 && x > W - 70)) return;
    if (idle.current) clearTimeout(idle.current);
    chrome.set(withTiming(0, { duration: 180 }));
    setChromeOn(false);
    justHid.current = true;
    setTimeout(() => (justHid.current = false), 300);
  };
  useEffect(() => {
    arm();
    return () => {
      if (idle.current) clearTimeout(idle.current);
    };
  }, [arm]);
  const chromeFade = useAnimatedStyle(() => ({ opacity: chrome.get() }));
  // The rail stays in place and only fades in as the text comes up (no sliding with the pull).
  const railIn = useAnimatedStyle(() => ({ opacity: interpolate(rise.get(), [0.6, 1], [0, 1], Extrapolation.CLAMP) }));
  const barIn = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - rise.get()) * (BAR_H + 20) }] }));

  // Double tap on the text likes the article (never unlikes) and pops a big heart where the finger was.
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number; tilt: number }[]>([]);
  const heartId = useRef(0);
  const onDoubleTap = (x: number, y: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!liked) toggleLike();
    const id = ++heartId.current;
    setHearts((h) => [...h, { id, x, y, tilt: Math.random() * 24 - 12 }]);
  };
  const dropHeart = useCallback((id: number) => setHearts((h) => h.filter((v) => v.id !== id)), []);
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    // eslint-disable-next-line react-hooks/refs -- gesture callbacks run on gesture events, not during render
    .onEnd((e, ok) => {
      if (ok && rise.get() > 0.5) runOnJS(onDoubleTap)(e.absoluteX, e.absoluteY);
    });

  const toggleFollow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowing((v) => !v);
  };

  // `t`: 0 = closed (only the picture in the list), 1 = reader open. While `flying` is 1 a copy of the cover moves
  // between the picture and the preview's picture and the real one is hidden; without an origin everything fades.
  const [origin] = useState(() => articleOrigin(article.id));
  const t = useSharedValue(0);
  const flying = useSharedValue(origin ? 1 : 0);
  const landed = useSharedValue(0); // the flight is over
  const [opened, setOpened] = useState(false);
  // Where the preview's picture is (window coordinates), known after its first layout.
  const [picture, setPicture] = useState<Rect | null>(null);
  // The cover's own width / height: the preview → text morph crops it exactly like both pictures it joins.
  // The copy of the cover is a new image view: start flying once it is on screen (it sits exactly over the
  // picture in the list until then), or after a short wait if it never says so.
  const [coverReady, setCoverReady] = useState(!origin);
  useEffect(() => {
    if (coverReady) return;
    const timer = setTimeout(() => setCoverReady(true), 250);
    return () => clearTimeout(timer);
  }, [coverReady]);
  // Never stay invisible: without a layout in 400ms the reader opens anyway (the cover flies to the design's slot).
  useEffect(() => {
    if (picture) return;
    const timer = setTimeout(() => setPicture((p) => p ?? { x: 15, y: top + 376, w: pictureW, h: pictureH }), 400);
    return () => clearTimeout(timer);
  }, [picture, top, pictureW, pictureH]);
  useEffect(() => {
    if (!coverReady || !picture) return;
    t.set(withTiming(1, { duration: origin ? OPEN_MS : 220, easing: OPEN_EASING }, (fin) => {
      if (fin) landed.set(1);
    }));
  }, [coverReady, picture, origin, t, landed]);
  // The flying copy only leaves once the real cover under it is on screen, or the picture would blink as they swap
  // (a short wait is the fallback).
  const coverShown = useSharedValue(origin ? 0 : 1);
  useEffect(() => {
    const timer = setTimeout(() => coverShown.set(1), 900);
    return () => clearTimeout(timer);
  }, [coverShown]);
  useAnimatedReaction(
    () => landed.get() === 1 && coverShown.get() === 1,
    (go, was) => {
      if (go && !was) {
        flying.set(0);
        runOnJS(setOpened)(true);
      }
    },
  );
  const onCoverShown = useCallback(() => setCoverReady(true), []);
  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    // Back into the list picture from the preview; from a text page the reader just fades.
    const fly = !!articleOrigin(article.id) && rise.get() < 0.5;
    runOnUI(() => {
      'worklet';
      if (fly) flying.set(1);
      t.set(withTiming(0, { duration: fly ? CLOSE_MS : 200, easing: CLOSE_EASING }, (fin) => {
        if (fin) runOnJS(backWhenReady)();
      }));
    })();
  }, [article.id, flying, t, rise]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);
  // One pan, activated by hand once the finger has moved 10pt, the direction taken from the touch positions and their
  // ratio (Android reports no translation in onStart; a thumb swipe on an iPhone drifts sideways at once):
  //  - on the preview, pulling up from the bottom brings the text up over it;
  //  - on the first text page, pulling down takes it back to the preview;
  //  - on the text, sideways turns the pages (follows the finger, snaps to the nearest or the next page on a flick);
  //  - left to right on the preview or the first text page closes the article (it follows the finger; past a quarter
  //    of the screen or on a flick it slides away, otherwise it springs back), like the back button.
  const axis = useSharedValue(0); // 0 undecided, 1 text pages, 2 up to the text, 3 down to the preview, 4 close (right)
  const dragX = useSharedValue(0);
  const swipedAway = useCallback(() => {
    closing.current = true;
    backWhenReady();
  }, []);
  const startPage = useSharedValue(0);
  const lastPage = useSharedValue(0);
  useEffect(() => {
    lastPage.set(Math.max(0, textCount - 1));
  }, [textCount, lastPage]);
  const hasText = useSharedValue(false);
  useEffect(() => {
    hasText.set(textCount > 0);
  }, [textCount, hasText]);
  const PAGE_SPRING = { damping: 26, stiffness: 260, mass: 0.9, overshootClamping: true };
  const RISE_SPRING = { damping: 28, stiffness: 220, mass: 0.9, overshootClamping: true };
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e) => {
      touchX.set(e.allTouches[0]?.absoluteX ?? 0);
      touchY.set(e.allTouches[0]?.absoluteY ?? 0);
      axis.set(0);
    })
    .onTouchesMove((e, manager) => {
      if (axis.get() !== 0) return;
      const touch = e.allTouches[0];
      if (!touch) return;
      const dx = touch.absoluteX - touchX.get();
      const dy = touch.absoluteY - touchY.get();
      if (dx * dx + dy * dy < 100) return;
      if (t.get() < 0.99) return manager.fail();
      const onText = rise.get() > 0.5;
      if (Math.abs(dx) > Math.abs(dy)) {
        // Left to right with nothing to go back to (preview, first text page) closes; otherwise sideways pages.
        if (dx > 0 && (!onText || scrollX.get() < 1)) axis.set(4);
        else if (!onText || !hasText.get()) return manager.fail();
        else {
          axis.set(1);
          startPage.set(Math.round(scrollX.get() / W));
        }
      } else if (!onText && dy < 0 && hasText.get()) axis.set(2);
      else if (onText && dy > 0 && scrollX.get() < 1) axis.set(3);
      else return manager.fail();
      // TEMP debug (reader swipes on iPhone): remove once confirmed.
      console.log('[reader-debug] axis=' + axis.get() + ' dx=' + dx.toFixed(0) + ' dy=' + dy.toFixed(0));
      manager.activate();
    })
    .onUpdate((e) => {
      const a = axis.get();
      if (a === 1) {
        scrollX.set(Math.max(0, Math.min(lastPage.get() * W, startPage.get() * W - e.translationX)));
      } else if (a === 2) {
        rise.set(Math.max(0, Math.min(1, -e.translationY / (H * 0.55))));
      } else if (a === 3) {
        rise.set(Math.max(0, Math.min(1, 1 - e.translationY / (H * 0.55))));
      } else if (a === 4) {
        dragX.set(Math.max(0, e.translationX));
      }
    })
     
    // eslint-disable-next-line react-hooks/refs -- gesture callbacks run on gesture events, not during render
    .onEnd((e) => {
      const a = axis.get();
      if (a === 1) {
        const from = startPage.get();
        let to = Math.round((scrollX.get() - e.velocityX * 0.12) / W);
        to = Math.max(0, Math.min(lastPage.get(), Math.max(from - 1, Math.min(from + 1, to))));
        scrollX.set(withSpring(to * W, { ...PAGE_SPRING, velocity: -e.velocityX }));
        runOnJS(setPage)(to + 1);
      } else if (a === 2 || a === 3) {
        const open = a === 2 ? rise.get() > 0.25 || e.velocityY < -600 : !(rise.get() < 0.75 || e.velocityY > 600);
        rise.set(withSpring(open ? 1 : 0, { ...RISE_SPRING, velocity: -e.velocityY / (H * 0.55) }));
        runOnJS(setPage)(open ? 1 : 0);
      } else if (a === 4) {
        if (dragX.get() > W * 0.25 || e.velocityX > 700) {
          const left = Math.max(0, W - dragX.get());
          dragX.set(withTiming(W, { duration: Math.min(260, Math.max(140, (left / Math.max(e.velocityX, 1)) * 1000)), easing: Easing.out(Easing.quad) }, (fin) => {
            if (fin) runOnJS(swipedAway)();
          }));
        } else dragX.set(withSpring(0, { damping: 22, stiffness: 260 }));
      }
    })
    .onFinalize(() => {
      axis.set(0);
    });
  const singleTap = Gesture.Tap()
    // eslint-disable-next-line react-hooks/refs -- gesture callbacks run on gesture events, not during render
    .onEnd((e, ok) => {
      if (ok) runOnJS(tapped)(e.absoluteX, e.absoluteY);
    });
  const readerGestures = Gesture.Simultaneous(pan, doubleTap, singleTap);
  const pagesRow = useAnimatedStyle(() => ({
    // closing from the text fades it out before the white behind it goes, so the list never shows text over it
    opacity: interpolate(rise.get(), [0.25, 0.9], [0, 1], Extrapolation.CLAMP) * interpolate(t.get(), [0.3, 0.9], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: (1 - rise.get()) * H * 0.55 }, { translateX: -scrollX.get() }],
  }));
  // White early in the flight, so the picture left behind in the list doesn't show through while the copy flies.
  const paper = useAnimatedStyle(() => ({ opacity: interpolate(t.get(), [0, 0.3], [0, 1], Extrapolation.CLAMP) }));
  // Behind the reader: fades as it is pulled away to the right, so the list shows through.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.get(), [0, 0.3], [0, 1], Extrapolation.CLAMP) * interpolate(dragX.get(), [0, W], [1, 0], Extrapolation.CLAMP),
  }));
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.get() }] }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: interpolate(t.get(), [0.35, 1], [0, 1], Extrapolation.CLAMP) }));
  const pictureVisible = useAnimatedStyle(() => ({ opacity: origin ? 1 - flying.get() : t.get() }));

  // The preview layer starts at the window's top-left, so the picture's layout box is its window rect.
  const measurePicture = (e: LayoutChangeEvent) => {
    const { x, y, width: w, height: h } = e.nativeEvent.layout;
    if (w > 0) setPicture((p) => p ?? { x, y, w, h });
  };


  return (
    <View style={styles.root} onTouchStart={touch}>
      <Animated.View collapsable={false} pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
      <GestureDetector gesture={readerGestures}>
      <Animated.View collapsable={false} style={[StyleSheet.absoluteFill, styles.slide, slideStyle]}>
      <Animated.View collapsable={false} pointerEvents="none" style={[styles.backdrop, paper]} />
      <View pointerEvents="none" style={styles.measure}>
        <Text style={[styles.body, { width: textWidth }]} onTextLayout={(e) => setLines(e.nativeEvent.lines.map((l) => l.text))}>
          {fullText}
        </Text>
      </View>

      {/* Text pages' cover strip: the blur source of the author card. */}
      {/* Mounted once the cover has landed: building the pages during the flight cost frames. Text page i sits at
          (i + 1) screens; the preview above them slides with the same offset. */}
      {pages && opened ? (
        <Animated.View collapsable={false} entering={FadeIn.duration(220)} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View collapsable={false} style={[StyleSheet.absoluteFill, pagesRow]}>
            {pages.map((text, i) => (
              <ReaderPage key={i} text={text} width={W} left={i * W} textWidth={textWidth} top={top + TEXT_TOP} />
            ))}
          </Animated.View>
        </Animated.View>
      ) : null}

      <Animated.View collapsable={false} pointerEvents={page === 0 || !chromeOn ? 'none' : 'box-none'} style={[StyleSheet.absoluteFill, chromeFade]}>
        {/* Frame AutoLayouted-23/-24: a rail on the left (x 1, y 259, 39 wide, r 20, hairline border): the author with a
            follow "+" (tap the face for the profile), like, comments, share, bookmark, counts under the icons. */}
        <Animated.View collapsable={false} style={[styles.rail, { top: top + 212 }, railIn]}>
          <View style={styles.railAuthor}>
            <Pressable onPress={() => openProfile(article.author.username, true)} hitSlop={6} accessibilityRole="link" accessibilityLabel={article.author.username}>
              <AuthorAvatar author={article.author} size={32} />
            </Pressable>
            {following ? null : (
              <PressableScale onPress={toggleFollow} hitSlop={8} scaleTo={0.8} style={styles.railPlus} accessibilityRole="button" accessibilityLabel="Follow">
                <Icon name="profilePlus" width={9} height={9} tintColor="#FFFFFF" />
              </PressableScale>
            )}
          </View>
          <LikeButton
            liked={liked}
            onToggle={toggleLike}
            count={likes}
            icons={{ off: 'readerLike', on: 'readerLikeFilled' }}
            width={23.5}
            height={19.5}
            gap={4}
            style={styles.railItem}
            countStyle={styles.barText}
          />
          <RailItem icon="readerComment" w={20.5} h={20.5} label={String(article.comments + addedComments)} onPress={() => setCommenting(true)} />
          <RailItem icon="readerShare" w={16.4} h={16.4} label={String(article.shares)} onPress={() => setSharing(true)} />
          <PressableScale onPress={toggleSave} hitSlop={10} accessibilityLabel="Bookmark" style={styles.railItem}>
            <Icon name="readerBookmark" width={16.5} height={18.5} tintColor={saved ? colors.primary : undefined} />
          </PressableScale>
        </Animated.View>

        <Animated.View collapsable={false} style={[styles.close, { top: top - 16 }, cardIn]}>
          <PressableScale onPress={close} hitSlop={10} scaleTo={0.9} accessibilityLabel="Close">
            <Icon name="readerClose2" width={31} />
          </PressableScale>
        </Animated.View>

      </Animated.View>

      {/* the page number stays while reading: it does not go with the chrome that fades after a moment */}
      {pages && pages.length > 1 ? (
        <Animated.View collapsable={false} pointerEvents="none" style={[styles.pageCount, { bottom: insets.bottom + 10 }, barIn]}>
          <PageCount count={pages.length} width={W} scrollX={scrollX} />
        </Animated.View>
      ) : null}

      <Animated.View collapsable={false} pointerEvents={page === 0 ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, styles.preview, previewOut]}>
        <Animated.View collapsable={false} style={[styles.previewHead, { marginTop: top }, chromeStyle]}>
          <PressableScale onPress={close} hitSlop={12} scaleTo={0.85} accessibilityLabel="Back" style={styles.previewBack}>
            <Icon name="searchBack" width={14} height={25} />
          </PressableScale>
          <Pressable onPress={() => openProfile(article.author.username, true)} hitSlop={6} accessibilityRole="link" style={styles.previewAuthor}>
            <AuthorAvatar author={article.author} size={26} />
            <Text style={styles.previewName} numberOfLines={1}>
              {article.author.username}
            </Text>
          </Pressable>
          <PressableScale onPress={() => setMenu(true)} hitSlop={12} scaleTo={0.85} accessibilityLabel="More" style={styles.previewMore}>
            <View style={styles.moreDot} />
            <View style={styles.moreDot} />
            <View style={styles.moreDot} />
          </PressableScale>
        </Animated.View>
        <Animated.View collapsable={false} pointerEvents="none" style={chromeStyle}>
          <Text style={styles.previewTitle}>{titleCase(article.title)}</Text>
          <Text style={styles.previewMeta}>
            {/* TH(2): only the page count ("· N min read" is gone); a space holds the line until it is known */}
            {pages ? `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}` : ' '}
          </Text>
          {article.subtitle ? <Text style={styles.previewSubtitle}>{article.subtitle}</Text> : null}
        </Animated.View>
        <Animated.View
          collapsable={false}
          pointerEvents="none"
          onLayout={measurePicture}
          style={[styles.picture, { width: pictureW, height: pictureH, marginTop: article.subtitle ? 40.96 : 51.7 }, pictureVisible]}>
          <Image source={article.cover} style={styles.fill} contentFit="cover" onDisplay={() => coverShown.set(1)} />
        </Animated.View>
        <Animated.View collapsable={false} pointerEvents="box-none" style={[styles.previewBar, { bottom: Math.max(insets.bottom, 12) + 55 }, chromeStyle]}>
          <PressableScale onPress={() => setSharing(true)} hitSlop={8} accessibilityLabel="Share" style={styles.previewShare}>
            <Icon name="readerShare" width={18.4} height={18.4} />
            <Text style={styles.previewCount}>{article.shares}</Text>
          </PressableScale>
          <PressableScale onPress={toggleSave} hitSlop={10} accessibilityLabel="Bookmark" style={styles.previewBookmark}>
            <Icon name="readerBookmark" width={18.5} height={21.5} tintColor={saved ? colors.primary : undefined} />
          </PressableScale>
        </Animated.View>
      </Animated.View>

      {origin && picture ? <FlyingCover origin={origin} source={article.cover} t={t} flying={flying} target={picture} onShown={onCoverShown} /> : null}


      {hearts.map((h) => (
        <BigHeart key={h.id} id={h.id} x={h.x} y={h.y} tilt={h.tilt} onDone={dropHeart} />
      ))}
      </Animated.View>
      </GestureDetector>
      {sharing ? <ShareSheet article={article} onClose={() => setSharing(false)} /> : null}
      {commenting ? <CommentsSheet articleId={article.id} onClose={() => setCommenting(false)} /> : null}
      <PostActions
        visible={menu}
        onClose={() => setMenu(false)}
        actions={[
          { label: saved ? 'Remove from saved' : 'Save', onPress: toggleSave },
          { label: 'Share', onPress: () => setSharing(true) },
          { label: 'Report', destructive: true, onPress: () => Alert.alert('Thanks for letting us know', 'We will look at this article.') },
        ]}
      />
    </View>
  );
}

/**
 * The cover in flight: a window moving from the tapped picture to the cover slot. Only transforms (plus radius and
 * opacity) change per frame, so the window and the picture inside move in the same UI-thread update: the window is
 * a fixed width x coverH box scaled to the current rect, and the picture (fixed size, so it never re-decodes) is
 * counter-scaled to stay undistorted and to keep filling the window like contentFit "cover".
 */
function FlyingCover({
  origin,
  source,
  t,
  flying,
  target,
  onShown,
}: {
  origin: ArticleOrigin;
  source: Picture;
  t: SharedValue<number>;
  flying: SharedValue<number>;
  target: Rect;
  onShown: () => void;
}) {
  const aspect = origin.aspect ?? origin.w / origin.h;
  const BW = target.w;
  const BH = target.h;
  // Height of the picture when it covers a w x h box.
  const coverHeight = (w: number, h: number) => {
    'worklet';
    return Math.max(h, w / aspect);
  };
  const IH = Math.max(coverHeight(origin.w, origin.h), coverHeight(BW, BH));
  const IW = IH * aspect;
  const frame = useAnimatedStyle(() => {
    const k = t.get();
    const w = origin.w + (BW - origin.w) * k;
    const h = origin.h + (BH - origin.h) * k;
    const sx = w / BW;
    const sy = h / BH;
    return {
      opacity: flying.get(),
      borderRadius: (origin.radius * (1 - k) + k) / ((sx + sy) / 2),
      transform: [
        { translateX: origin.x + (target.x - origin.x) * k + w / 2 - BW / 2 },
        { translateY: origin.y + (target.y - origin.y) * k + h / 2 - BH / 2 },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  });
  const picture = useAnimatedStyle(() => {
    const k = t.get();
    const w = origin.w + (BW - origin.w) * k;
    const h = origin.h + (BH - origin.h) * k;
    const sc = coverHeight(w, h) / IH;
    return { transform: [{ scaleX: (sc * BW) / w }, { scaleY: (sc * BH) / h }] };
  });
  return (
    <Animated.View collapsable={false} pointerEvents="none" style={[styles.flying, { width: BW, height: BH }, frame]}>
      <Animated.View collapsable={false} style={[{ position: 'absolute', left: BW / 2 - IW / 2, top: BH / 2 - IH / 2, width: IW, height: IH }, picture]}>
        <Image source={source} style={styles.fill} contentFit="cover" onDisplay={onShown} />
      </Animated.View>
    </Animated.View>
  );
}

/** Follow ↔ Following: the fill and text colour cross-fade, the word rolls. */
const HEART_W = 92;
const HEART_H = (HEART_W * 19.75) / 23.5;

/** Pops in with a little overshoot, holds, then floats up and fades; removes itself when done. */
function BigHeart({ id, x, y, tilt, onDone }: { id: number; x: number; y: number; tilt: number; onDone: (id: number) => void }) {
  const scale = useSharedValue(0);
  const lift = useSharedValue(0);
  const fade = useSharedValue(1);
  useEffect(() => {
    scale.set(withSequence(withSpring(1.12, { damping: 9, stiffness: 320, mass: 0.7 }), withSpring(1, { damping: 14, stiffness: 260 })));
    lift.set(withDelay(420, withTiming(-46, { duration: 380, easing: Easing.in(Easing.cubic) })));
    fade.set(withDelay(
      440,
      withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) }, (fin) => {
        if (fin) runOnJS(onDone)(id);
      }),
    ));
  }, [id, onDone, scale, lift, fade]);
  const style = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ translateY: lift.get() }, { rotate: `${tilt}deg` }, { scale: scale.get() }],
  }));
  return (
    <Animated.View collapsable={false} pointerEvents="none" style={[styles.bigHeart, { left: x - HEART_W / 2, top: y - HEART_H / 2 }, style]}>
      <Icon name="readerLikeFilled" width={HEART_W} height={HEART_H} />
    </Animated.View>
  );
}

function ReaderPage({ text, width, left, textWidth, top }: { text: string; width: number; left: number; textWidth: number; top: number }) {
  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left, width }}>
      <Text style={[styles.body, styles.pageText, { top, width: textWidth }]}>{text}</Text>
    </View>
  );
}

// The page number under the text (newest frame: just "2", #999), following the page in view.
function PageCount({ count, width, scrollX }: { count: number; width: number; scrollX: SharedValue<number> }) {
  const [page, setPage] = useState(1);
  useAnimatedReaction(
    () => Math.min(count, Math.max(1, Math.round(scrollX.get() / width) + 1)),
    (n, prev) => {
      if (n !== prev) runOnJS(setPage)(n);
    },
  );
  return (
    <Text style={styles.pageCountText}>
      {page}
    </Text>
  );
}

function RailItem({ icon, w, h, label, onPress }: { icon: IconName; w: number; h: number; label: string; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress} disabled={!onPress} hitSlop={8} style={styles.railItem}>
      <Icon name={icon} width={w} height={h} />
      <Text style={styles.barText}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#FFFFFF' },
  bigHeart: { position: 'absolute', width: HEART_W, height: HEART_H },
  // Transparent: the list stays visible while the reader opens and closes over it.
  root: { flex: 1 },
  slide: { overflow: 'hidden' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: READER_BG },
  // No fill: until the copy is drawn, the same picture in the list shows through.
  flying: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  measure: { position: 'absolute', left: 0, top: 0, opacity: 0 },
  cover: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden', backgroundColor: colors.surfaceSoft },
  fill: { width: '100%', height: '100%' },
  pageText: { position: 'absolute', left: TEXT_LEFT },
  // ~17.8 / 26.5 in AutoLayouted 17 (cap 12.3).
  body: { fontFamily: fonts.reading, fontSize: 18.6, lineHeight: LINE_HEIGHT, letterSpacing: -0.04, color: READER_TEXT },

  // Preview (AutoLayouted-18): header 45 to a 1px #E9E9E9 rule; title Inter ExtraBold 31 / 43.7 (−0.75) at 93;
  // "N pages · N min read" Inter Medium 12.3 27 under it; subtitle Inter 16.3 / 26.4 #0F1419 (TH); the picture 360x272 at
  // x 15, 25 under the subtitle; share (18.4) + count and bookmark 50 above the safe area.
  preview: { backgroundColor: READER_BG },
  previewHead: { height: 45, borderBottomWidth: 1, borderBottomColor: '#E9E9E9' },
  previewBack: { position: 'absolute', left: 15.5, top: 8.5 },
  previewAuthor: { position: 'absolute', left: 60, right: 60, top: 8, flexDirection: 'row', justifyContent: 'center', transform: [{ translateX: -5.6 }] },
  previewName: { marginLeft: 9.2, marginTop: 3.85, fontFamily: INTER_FAMILIES['600'], fontSize: 15, lineHeight: 18, letterSpacing: 0.075, color: colors.text },
  previewMore: { position: 'absolute', right: 17.8, top: 17.8, flexDirection: 'row', gap: 3.67 },
  moreDot: { width: 3.33, height: 3.33, borderRadius: 1.67, backgroundColor: '#000000' },
  previewTitle: { marginTop: 47.07, marginLeft: 15, width: 360, fontFamily: INTER_FAMILIES['800'], fontSize: 34.75, lineHeight: 43.7, letterSpacing: -1.39, color: colors.text },
  previewMeta: { marginTop: 26.97, marginLeft: 16.5, fontFamily: INTER_FAMILIES['400'], fontSize: 12.75, lineHeight: 15, letterSpacing: 0.1275, color: colors.text },
  previewSubtitle: { marginTop: 5.7, marginLeft: 16, width: 345, fontFamily: INTER_FAMILIES['400'], fontSize: 16.75, lineHeight: 26.4, letterSpacing: 0.1675, color: colors.text },
  picture: { marginLeft: 15, borderRadius: 1, overflow: 'hidden', backgroundColor: colors.surfaceSoft },
  previewBar: { position: 'absolute', left: 0, right: 0, height: 22 },
  previewShare: { position: 'absolute', left: 21.05, top: 1.8, flexDirection: 'row', alignItems: 'center', gap: 13.5 },
  previewCount: { fontFamily: INTER_FAMILIES['400'], fontSize: 14, lineHeight: 16, color: colors.text },
  previewBookmark: { position: 'absolute', left: 348, top: -0.25 },

  // Text pages (AutoLayouted 17): card 354x48 at (16.5, 23.5), radius 13.5; avatar 32 at (6.5, 7.5), name Inter Bold
  // 12.5 and "You Follow" 12.1 from x 44.7; dots at 223.6; Follow 82x25 black at (265.5, 7.5); ✕ circle 31 at
  // (338, −16); the bar from y 771 (hairline #E5E5E5), its items at fixed x.
  card: {
    position: 'absolute',
    left: 16.5,
    width: 354,
    height: 48,
    borderRadius: 13.5,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 0.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  glassFill: { flex: 1 },
  author: { position: 'absolute', left: 6.5, top: 7.5, flexDirection: 'row', alignItems: 'flex-start' },
  authorNames: { marginLeft: 6.2, marginTop: 1.02 },
  authorName: { fontFamily: INTER_FAMILIES['700'], fontSize: 12.5, lineHeight: 15, letterSpacing: 0.2, color: colors.text },
  authorSub: { marginLeft: 1, fontFamily: INTER_FAMILIES['400'], fontSize: 12.1, lineHeight: 15, color: colors.text },
  dots: { position: 'absolute', left: 223.6, top: 10.6, flexDirection: 'row', gap: 4.17 },
  dot: { width: 5.83, height: 5.83, borderRadius: 3 },
  followAt: { position: 'absolute', left: 265.5, top: 7.5 },
  follow: { width: 82, height: 25, borderRadius: 12.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  followText: { fontFamily: INTER_FAMILIES['600'], fontSize: 12.5 },
  close: { position: 'absolute', left: 338 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopWidth: 0.5, borderTopColor: '#E5E5E5' },
  barItem: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 9.5 },
  barBookmark: { position: 'absolute', left: 323.75, top: 12.75 },
  rail: { position: 'absolute', left: 1, width: 39, paddingTop: 9.5, paddingBottom: 14, borderRadius: 20, borderWidth: 1, borderColor: '#EDEDED', backgroundColor: colors.bg, alignItems: 'center', gap: 20 },
  railAuthor: { width: 32, height: 38 },
  railPlus: { position: 'absolute', left: 17, top: 21, width: 17, height: 17, borderRadius: 8.5, borderWidth: 1.5, borderColor: '#FFFFFF', backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  railItem: { flexDirection: 'column', alignItems: 'center', gap: 4 },
  pageCount: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pageCountText: { fontFamily: fonts.reading, fontSize: 13, lineHeight: 16, color: '#999999' },
  barText: { fontFamily: INTER_FAMILIES['400'], fontSize: 12.6, lineHeight: 16, color: colors.text },
});
