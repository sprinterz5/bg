import { BlurTargetView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  runOnUI,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthorAvatar } from '@/components/author-row';
import { Glass } from '@/components/glass';
import { Icon, type IconName } from '@/components/icon';
import { LikeButton } from '@/components/like-button';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { PressableScale } from '@/components/pressable-scale';
import { RollingLabel } from '@/components/rolling-label';
import { paginateLines } from '@/lib/paginate';
import type { Article } from '@/mock/data';
import { useFeed } from '@/state/feed';
import { colors, fonts } from '@/theme';
import { AnimatedText, Text } from '@/components/text';
import { articleOrigin, type ArticleOrigin } from '@/lib/article-origin';
import { backWhenReady } from '@/lib/nav';

// Values from Figma frames 3110:157 (page 1) and 3110:311 (page 2); design status bar = 47.
const LINE_HEIGHT = 23;
const TEXT_SIDE = 39;
const CARD_LEFT = 5;
const CARD_PAD_TOP = 8;
const ROW_H = 32;
const TITLE_GAP = 16;
const CARD_PAD_BOTTOM = 9;
const CARD_H_COMPACT = 50;
const TEXT_GAP_1 = 27;
const TEXT_GAP_2 = 35;
const PAGE_BOTTOM_PAD = 10;
const PARALLAX = 24;
// Open / close (not in the design): the cover grows out of the tapped picture (feed, Explore, profile) and the rest
// of the reader comes in after it; closing shrinks the cover back into that picture.
const OPEN_MS = 440;
const CLOSE_MS = 360;
const OPEN_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
const CLOSE_EASING = Easing.bezier(0.4, 0, 0.2, 1);

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { articles } = useFeed();
  const article = id ? articles[id] : undefined;
  if (!article) return <PlaceholderScreen title="Article not found" showBack />;
  return <Reader article={article} />;
}

function Reader({ article }: { article: Article }) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const targetRef = useRef<View>(null);
  const scrollX = useSharedValue(0);

  const [lines, setLines] = useState<string[] | null>(null);
  const [titleH, setTitleH] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const top = insets.top;
  const IMG_H = top + 180;
  const SHEET_1 = top + 180;
  const SHEET_2 = top + 85;
  const CARD_TOP_1 = top + 135;
  const CARD_TOP_2 = top + 48;
  const CARD_W_1 = W + 38;
  const CARD_W_2 = W - 22;
  const CARD_H_1 = CARD_PAD_TOP + ROW_H + TITLE_GAP + (titleH ?? 0) + CARD_PAD_BOTTOM;
  const TEXT_TOP_1 = CARD_TOP_1 + CARD_H_1 + TEXT_GAP_1;
  const TEXT_TOP_2 = CARD_TOP_2 + CARD_H_COMPACT + TEXT_GAP_2;
  const BAR_H = 1 + 11 + 22 + Math.max(insets.bottom, 12);
  const textWidth = W - TEXT_SIDE * 2;

  const fullText = useMemo(() => article.body.map((p) => `  ${p}`).join('\n\n'), [article.body]);

  const pages = useMemo(() => {
    if (!lines || titleH === null) return null;
    return paginateLines(lines, LINE_HEIGHT, {
      first: H - BAR_H - TEXT_TOP_1 - PAGE_BOTTOM_PAD,
      rest: H - BAR_H - TEXT_TOP_2 - PAGE_BOTTOM_PAD,
    });
  }, [lines, titleH, H, BAR_H, TEXT_TOP_1, TEXT_TOP_2]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollX.value, [0, W], [0, -PARALLAX], Extrapolation.CLAMP) }],
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollX.value, [0, W], [SHEET_1, SHEET_2], Extrapolation.CLAMP) }],
  }));
  const cardStyle = useAnimatedStyle(() => {
    const x = scrollX.value;
    return {
      top: interpolate(x, [0, W], [CARD_TOP_1, CARD_TOP_2], Extrapolation.CLAMP),
      height: interpolate(x, [0, W], [CARD_H_1, CARD_H_COMPACT], Extrapolation.CLAMP),
      width: interpolate(x, [0, W], [CARD_W_1, CARD_W_2], Extrapolation.CLAMP),
    };
  });
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [0, W * 0.45], [1, 0], Extrapolation.CLAMP),
  }));
  // Section 7: on page 2+ the close button sits 9.5px higher (design y 38.5 instead of 48).
  const closeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollX.value, [0, W], [0, -9.5], Extrapolation.CLAMP) }],
  }));

  // Double tap on the text likes the article (never unlikes) and pops a big heart where the finger was.
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number; tilt: number }[]>([]);
  const heartId = useRef(0);
  const onDoubleTap = useCallback((x: number, y: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked(true);
    const id = ++heartId.current;
    setHearts((h) => [...h, { id, x, y, tilt: Math.random() * 24 - 12 }]);
  }, []);
  const dropHeart = useCallback((id: number) => setHearts((h) => h.filter((v) => v.id !== id)), []);
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .onEnd((e, ok) => {
      if (ok) runOnJS(onDoubleTap)(e.absoluteX, e.absoluteY);
    });

  const toggleFollow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowing((v) => !v);
  };

  // `t`: 0 = closed (only the picture in the list), 1 = reader open. While `flying` is 1 a copy of the cover moves
  // between the picture and the cover slot and the real cover is hidden; without an origin everything just fades.
  const [origin] = useState(() => articleOrigin(article.id));
  const t = useSharedValue(0);
  const flying = useSharedValue(origin ? 1 : 0);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    t.value = withTiming(1, { duration: origin ? OPEN_MS : 220, easing: OPEN_EASING }, (fin) => {
      if (!fin) return;
      flying.value = 0;
      runOnJS(setOpened)(true);
    });
  }, [origin, t, flying]);
  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const fly = !!articleOrigin(article.id);
    runOnUI(() => {
      'worklet';
      if (fly) flying.value = 1;
      t.value = withTiming(0, { duration: fly ? CLOSE_MS : 200, easing: CLOSE_EASING }, (fin) => {
        if (fin) runOnJS(backWhenReady)();
      });
    })();
  }, [article.id, flying, t]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: t.value }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0.35, 1], [0, 1], Extrapolation.CLAMP) }));
  const coverVisible = useAnimatedStyle(() => ({ opacity: origin ? 1 - flying.value : t.value }));

  return (
    <View style={styles.root}>
      <Animated.View collapsable={false} pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
      <View pointerEvents="none" style={styles.measure}>
        <Text style={[styles.title, { width: CARD_W_2 - 5 }]} onLayout={(e) => setTitleH(e.nativeEvent.layout.height)}>
          {article.title}
        </Text>
        <Text style={[styles.body, { width: textWidth }]} onTextLayout={(e) => setLines(e.nativeEvent.lines.map((l) => l.text))}>
          {fullText}
        </Text>
      </View>

      <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFill}>
        <Animated.View collapsable={false} style={[styles.cover, { height: IMG_H }, imageStyle, coverVisible]}>
          <Image source={article.cover} style={styles.fill} contentFit="cover" />
        </Animated.View>
        <Animated.View collapsable={false} style={[styles.sheet, { height: H }, sheetStyle, chromeStyle]} />
      </BlurTargetView>

      {origin ? <FlyingCover origin={origin} source={article.cover} t={t} flying={flying} width={W} coverH={IMG_H} /> : null}

      {/* Mounted once the cover has landed: building the pages during the flight cost frames. */}
      {pages && opened ? (
        <Animated.View collapsable={false} entering={FadeIn.duration(220)} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <GestureDetector gesture={doubleTap}>
        <Animated.FlatList
          data={pages}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={[StyleSheet.absoluteFill, chromeStyle]}
          renderItem={({ item, index }) => (
            <ReaderPage
              index={index}
              text={item}
              width={W}
              textWidth={textWidth}
              top={index === 0 ? TEXT_TOP_1 : TEXT_TOP_2}
              rise={TEXT_TOP_1 - TEXT_TOP_2}
              scrollX={scrollX}
            />
          )}
        />
        </GestureDetector>
        </Animated.View>
      ) : null}

      <Animated.View collapsable={false} style={[styles.card, cardStyle, chromeStyle]}>
        <Glass blurTarget={targetRef} blur={Platform.OS !== 'android' || opened} style={styles.glassFill}>
          <View style={[styles.cardRow, { width: CARD_W_2 - 14 }]}>
            <View style={styles.author}>
              <AuthorAvatar author={article.author} size={32} />
              <View>
                <Text style={styles.authorName}>{article.author.username}</Text>
                <Text style={styles.authorSub}>{following ? 'You Follow' : 'Suggested'}</Text>
              </View>
            </View>
            <View style={styles.cardRight}>
              {pages && pages.length > 1 ? <PageDots count={pages.length} width={W} scrollX={scrollX} /> : null}
              <FollowPill following={following} onPress={toggleFollow} />
            </View>
          </View>
          <AnimatedText style={[styles.title, styles.cardTitle, { width: CARD_W_2 - 5 }, titleStyle]}>{article.title}</AnimatedText>
        </Glass>
      </Animated.View>

      <Animated.View collapsable={false} style={[styles.close, { top: top + 1 }, closeStyle, chromeStyle]}>
        <PressableScale onPress={close} hitSlop={10} scaleTo={0.9} accessibilityLabel="Close">
          <Icon name="readerClose" width={33} />
        </PressableScale>
      </Animated.View>

      {hearts.map((h) => (
        <BigHeart key={h.id} id={h.id} x={h.x} y={h.y} tilt={h.tilt} onDone={dropHeart} />
      ))}

      <Animated.View collapsable={false} style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }, chromeStyle]}>
        <BarItem icon="readerComment" w={20.5} h={20.5} label={String(article.comments)} />
        <LikeButton
          liked={liked}
          onToggle={() => setLiked((v) => !v)}
          count={article.likes + (liked ? 1 : 0)}
          icons={{ off: 'readerLike', on: 'readerLikeFilled' }}
          width={23.5}
          height={19.75}
          style={styles.barItem}
          countStyle={styles.barText}
        />
        <BarItem icon="readerShare" w={16.4} h={16.4} label={String(article.shares)} />
        <PressableScale onPress={() => setSaved((v) => !v)} hitSlop={10} accessibilityLabel="Bookmark">
          <Icon name="readerBookmark" width={16.5} height={18.5} tintColor={saved ? colors.primary : undefined} />
        </PressableScale>
      </Animated.View>
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
  width,
  coverH,
}: {
  origin: ArticleOrigin;
  source: ImageSourcePropType;
  t: SharedValue<number>;
  flying: SharedValue<number>;
  width: number;
  coverH: number;
}) {
  const aspect = origin.aspect ?? origin.w / origin.h;
  // Height of the picture when it covers a w x h box.
  const coverHeight = (w: number, h: number) => {
    'worklet';
    return Math.max(h, w / aspect);
  };
  const IH = Math.max(coverHeight(origin.w, origin.h), coverHeight(width, coverH));
  const IW = IH * aspect;
  const frame = useAnimatedStyle(() => {
    const k = t.value;
    const w = origin.w + (width - origin.w) * k;
    const h = origin.h + (coverH - origin.h) * k;
    const sx = w / width;
    const sy = h / coverH;
    return {
      opacity: flying.value,
      borderRadius: (origin.radius * (1 - k)) / ((sx + sy) / 2),
      transform: [
        { translateX: origin.x * (1 - k) + w / 2 - width / 2 },
        { translateY: origin.y * (1 - k) + h / 2 - coverH / 2 },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  });
  const picture = useAnimatedStyle(() => {
    const k = t.value;
    const w = origin.w + (width - origin.w) * k;
    const h = origin.h + (coverH - origin.h) * k;
    const s = coverHeight(w, h) / IH;
    return { transform: [{ scaleX: (s * width) / w }, { scaleY: (s * coverH) / h }] };
  });
  return (
    <Animated.View collapsable={false} pointerEvents="none" style={[styles.flying, { width, height: coverH }, frame]}>
      <Animated.View collapsable={false} style={[{ position: 'absolute', left: width / 2 - IW / 2, top: coverH / 2 - IH / 2, width: IW, height: IH }, picture]}>
        <Image source={source} style={styles.fill} contentFit="cover" />
      </Animated.View>
    </Animated.View>
  );
}

/** Follow ↔ Following: the fill and text colour cross-fade, the word rolls. */
function FollowPill({ following, onPress }: { following: boolean; onPress: () => void }) {
  const on = useSharedValue(following ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(following ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [following, on]);
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(on.value, [0, 1], [colors.primary, 'rgba(15,20,25,0.08)']) }));
  const fg = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], ['#FFFFFF', colors.text]) }));
  return (
    <PressableScale onPress={onPress} scaleTo={0.94} accessibilityRole="button" accessibilityLabel={following ? 'Following' : 'Follow'}>
      <Animated.View collapsable={false} style={[styles.follow, bg]}>
        <RollingLabel text={following ? 'Following' : 'Follow'} style={[styles.followText, fg]} />
      </Animated.View>
    </PressableScale>
  );
}

const HEART_W = 92;
const HEART_H = (HEART_W * 19.75) / 23.5;

/** Pops in with a little overshoot, holds, then floats up and fades; removes itself when done. */
function BigHeart({ id, x, y, tilt, onDone }: { id: number; x: number; y: number; tilt: number; onDone: (id: number) => void }) {
  const scale = useSharedValue(0);
  const lift = useSharedValue(0);
  const fade = useSharedValue(1);
  useEffect(() => {
    scale.value = withSequence(withSpring(1.12, { damping: 9, stiffness: 320, mass: 0.7 }), withSpring(1, { damping: 14, stiffness: 260 }));
    lift.value = withDelay(420, withTiming(-46, { duration: 380, easing: Easing.in(Easing.cubic) }));
    fade.value = withDelay(
      440,
      withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) }, (fin) => {
        if (fin) runOnJS(onDone)(id);
      }),
    );
  }, [id, onDone, scale, lift, fade]);
  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: lift.value }, { rotate: `${tilt}deg` }, { scale: scale.value }],
  }));
  return (
    <Animated.View collapsable={false} pointerEvents="none" style={[styles.bigHeart, { left: x - HEART_W / 2, top: y - HEART_H / 2 }, style]}>
      <Icon name="readerLikeFilled" width={HEART_W} height={HEART_H} />
    </Animated.View>
  );
}

type PageProps = {
  index: number;
  text: string;
  width: number;
  textWidth: number;
  top: number;
  rise: number;
  scrollX: SharedValue<number>;
};

function ReaderPage({ index, text, width, textWidth, top, rise, scrollX }: PageProps) {
  const riseStyle = useAnimatedStyle(() => {
    if (index !== 1) return {};
    return { transform: [{ translateY: interpolate(scrollX.value, [0, width], [rise, 0], Extrapolation.CLAMP) }] };
  });

  return (
    <View style={{ width }}>
      <AnimatedText style={[styles.body, styles.pageText, { top, width: textWidth }, riseStyle]}>{text}</AnimatedText>
    </View>
  );
}

function PageDots({ count, width, scrollX }: { count: number; width: number; scrollX: SharedValue<number> }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} index={i} width={width} scrollX={scrollX} />
      ))}
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(scrollX.value / width - index));
    return { backgroundColor: interpolateColor(distance, [0, 1], ['#000000', colors.textSubtle]) };
  });
  return <Animated.View collapsable={false} style={[styles.dot, style]} />;
}

function BarItem({ icon, w, h, label, onPress }: { icon: IconName; w: number; h: number; label: string; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress} disabled={!onPress} hitSlop={8} style={styles.barItem}>
      <Icon name={icon} width={w} height={h} />
      <Text style={styles.barText}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bigHeart: { position: 'absolute', width: HEART_W, height: HEART_H },
  // Transparent: the list stays visible while the reader opens and closes over it.
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg },
  flying: { position: 'absolute', left: 0, top: 0, overflow: 'hidden', backgroundColor: colors.surfaceSoft },
  measure: { position: 'absolute', left: 0, top: 0, opacity: 0 },
  cover: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden', backgroundColor: colors.surfaceSoft },
  fill: { width: '100%', height: '100%' },
  sheet: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: colors.bg },
  pageText: { position: 'absolute', left: TEXT_SIDE },
  title: { fontFamily: fonts.display, fontSize: 23.35, lineHeight: 22.5, letterSpacing: -0.7, color: colors.text },
  cardTitle: { marginTop: TITLE_GAP, marginLeft: 6 },
  body: { fontFamily: fonts.reading, fontSize: 16.9, lineHeight: LINE_HEIGHT, letterSpacing: -0.04, color: '#000000' },
  card: {
    position: 'absolute',
    left: CARD_LEFT,
    borderRadius: 13,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 0.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  glassFill: { flex: 1, paddingTop: CARD_PAD_TOP, paddingLeft: 6 },
  cardRow: { height: ROW_H, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  author: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  authorName: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2, color: colors.text },
  authorSub: { fontSize: 12.5, letterSpacing: 0.19, color: colors.text, marginTop: 1 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingTop: 1 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 5.8, height: 5.8, borderRadius: 3 },
  follow: { width: 82, height: 24, borderRadius: 100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  followText: { fontSize: 13, fontWeight: '700' },
  close: { position: 'absolute', left: 11 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 11,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  barItem: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 22 },
  barText: { fontSize: 13, lineHeight: 22, letterSpacing: 0.13, color: colors.text },
});
