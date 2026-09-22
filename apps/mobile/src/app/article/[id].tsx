import { BlurTargetView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthorAvatar } from '@/components/author-row';
import { Glass } from '@/components/glass';
import { Icon, type IconName } from '@/components/icon';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { PressableScale } from '@/components/pressable-scale';
import { paginateLines } from '@/lib/paginate';
import type { Article } from '@/mock/data';
import { useFeed } from '@/state/feed';
import { colors, fonts } from '@/theme';
import { AnimatedText, Text } from '@/components/text';

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

  const toggleFollow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowing((v) => !v);
  };

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.measure}>
        <Text style={[styles.title, { width: CARD_W_2 - 5 }]} onLayout={(e) => setTitleH(e.nativeEvent.layout.height)}>
          {article.title}
        </Text>
        <Text style={[styles.body, { width: textWidth }]} onTextLayout={(e) => setLines(e.nativeEvent.lines.map((l) => l.text))}>
          {fullText}
        </Text>
      </View>

      <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.cover, { height: IMG_H }, imageStyle]}>
          <Image source={article.cover} style={styles.fill} contentFit="cover" />
        </Animated.View>
        <Animated.View style={[styles.sheet, { height: H }, sheetStyle]} />
      </BlurTargetView>

      {pages ? (
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
          style={StyleSheet.absoluteFill}
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
      ) : null}

      <Animated.View style={[styles.card, cardStyle]}>
        <Glass blurTarget={targetRef} style={styles.glassFill}>
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
              <PressableScale onPress={toggleFollow} scaleTo={0.94} style={[styles.follow, following && styles.following]} accessibilityRole="button">
                <Text style={[styles.followText, following && styles.followingText]}>{following ? 'Following' : 'Follow'}</Text>
              </PressableScale>
            </View>
          </View>
          <AnimatedText style={[styles.title, styles.cardTitle, { width: CARD_W_2 - 5 }, titleStyle]}>{article.title}</AnimatedText>
        </Glass>
      </Animated.View>

      <PressableScale onPress={() => router.back()} hitSlop={10} scaleTo={0.9} accessibilityLabel="Close" style={[styles.close, { top: top + 2 }]}>
        <Icon name="readerClose" width={33} />
      </PressableScale>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <BarItem icon="readerComment" w={20.5} h={20.5} label={String(article.comments)} />
        <BarItem
          icon={liked ? 'readerLikeFilled' : 'readerLike'}
          w={23.5}
          h={19.75}
          label={String(article.likes + (liked ? 1 : 0))}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setLiked((v) => !v);
          }}
        />
        <BarItem icon="readerShare" w={16.4} h={16.4} label={String(article.shares)} />
        <PressableScale onPress={() => setSaved((v) => !v)} hitSlop={10} accessibilityLabel="Bookmark">
          <Icon name="readerBookmark" width={16.5} height={18.5} tintColor={saved ? colors.primary : undefined} />
        </PressableScale>
      </View>
    </View>
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
  return <Animated.View style={[styles.dot, style]} />;
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
  root: { flex: 1, backgroundColor: colors.bg },
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
  follow: { width: 82, height: 24, borderRadius: 100, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  following: { backgroundColor: 'rgba(15,20,25,0.08)' },
  followText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  followingText: { color: colors.text },
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
