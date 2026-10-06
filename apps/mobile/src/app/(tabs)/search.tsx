import { Image } from 'expo-image';
import { useFocusEffect, useScrollToTop, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExploreCard } from '@/components/explore-card';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { AnimatedText, Text, TextInput } from '@/components/text';
import { searchUsers } from '@/lib/users';
import { EXPLORE_FEED, EXPLORE_TOPICS, SEARCH_ARTICLES, SEARCH_PROFILES, SEARCH_SUGGESTIONS, type Author, type ExplorePost } from '@/mock/data';
import { colors, motion } from '@/theme';
import { push } from '@/lib/nav';

// Figma: Explore 3163:1520, search focused 3154:579, suggestions 3158:793 / 3160:1291,
// profile results 3159:1041, article results 3170:2017. Design status bar = 47.
type Mode = 'explore' | 'typing' | 'results';
type Tab = 'articles' | 'profiles';

// Scrolled posts show 16px into the status bar area (the plain strip under the clock is 16px shorter);
// the field itself stays where it was.
const STATUS_OVERLAP = 16;
const FIELD_TOP = 7 + STATUS_OVERLAP; // y 55 in the frame, 1px higher by eye
const FIELD_H = 41;
// White strip under the fixed field so scrolling content doesn't cut right at its edge; offsets below are reduced by it.
const HEADER_BOTTOM = 8;
const HEADER_H = FIELD_TOP + FIELD_H + HEADER_BOTTOM;
// Frame 1081 Explore: no field, one row of topic tabs (30 tall at y 64) with a search button on the right;
// the first post starts at y 104. The field only shows up after tapping search.
const BAR_TOP = 17 + STATUS_OVERLAP;
const FEED_TOP = 57 + STATUS_OVERLAP;
// Tab widths from the frame (text centred); other topics get padding.
const CHIP_BG = '#F2F2F2';
const CHIP_ACTIVE = '#455DFF';
const TOPIC_W: Record<string, number> = { 'For You': 78, Books: 64, Following: 90, News: 58 };
const FIELD_BG = '#EFF3F4';
const PLACEHOLDER = '#536471';
const MUTED = '#737A84';
const PRESSED = '#F7F9F9';
const SEG_SIDE_L = 15;
const SEG_SIDE_R = 19;
const SEG_GAP = 4;
const EASE = { duration: motion.base, easing: Easing.out(Easing.cubic) };
const FADE_IN = FadeIn.duration(220);
const FADE_OUT = FadeOut.duration(140);

const MODE_VALUE: Record<Mode, number> = { explore: 0, typing: 1, results: 2 };

function tokens(q: string) {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

export default function Search() {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);
  // Tapping the Search tab again scrolls Explore back to the top (iOS: the list's top is -FEED_TOP, under the header).
  const feedRef = useRef<FlatList<(typeof EXPLORE_FEED)[number]>>(null);
  const scrollTarget = useMemo(
    () => ({ current: { scrollToTop: () => feedRef.current?.scrollToOffset({ offset: Platform.OS === 'ios' ? -FEED_TOP : 0, animated: true }) } }),
    [],
  );
  useScrollToTop(scrollTarget);
  const [mode, setMode] = useState<Mode>('explore');
  const [tab, setTab] = useState<Tab>('articles');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<string>(EXPLORE_TOPICS[0]);
  // Feed is still mock: the pull-to-refresh only shows the spinner.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const m = useSharedValue(0);
  useEffect(() => {
    m.value = withTiming(MODE_VALUE[mode], EASE);
  }, [mode, m]);

  // Field: x 8..380 (explore, 372 wide, no saved/liked button) → 15..325 (typing, "Exit" on the right) → 44..325 (results, back chevron on the left).
  const fieldStyle = useAnimatedStyle(() => ({
    marginLeft: interpolate(m.value, [0, 1, 2], [8, 15, 44]),
    marginRight: interpolate(m.value, [0, 1, 2], [10, 65, 65]),
  }));
  // Explore (Instagram-style): the topic bar leaves with the posts when scrolling down and comes back as soon as
  // you scroll up. It doesn't move on pull-to-refresh.
  const hidden = useSharedValue(0); // bar offset, 0..FEED_TOP
  const lastY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y + (Platform.OS === 'ios' ? FEED_TOP : 0);
    const next = Math.min(Math.max(hidden.value + y - lastY.value, 0), FEED_TOP);
    const h = Math.min(next, Math.max(y, 0)); // near the top it stays glued to the content
    if (h !== hidden.value) hidden.value = h;
    lastY.value = y;
  });
  useEffect(() => {
    if (mode !== 'explore') hidden.value = lastY.value = 0;
  }, [mode, hidden, lastY]);
  const barShift = useAnimatedStyle(() => ({ transform: [{ translateY: -hidden.value }] }));
  // The field header only exists while searching.
  const headerStyle = useAnimatedStyle(() => ({ opacity: interpolate(m.value, [0, 1], [0, 1], Extrapolation.CLAMP) }));
  const openSearch = useCallback(() => {
    setMode('typing');
    inputRef.current?.focus();
  }, []);
  const exitStyle = useAnimatedStyle(() => ({ opacity: interpolate(m.value, [0, 1], [0, 1], Extrapolation.CLAMP) }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(m.value, [1, 2], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(m.value, [1, 2], [-8, 0], Extrapolation.CLAMP) }],
  }));

  const exit = useCallback(() => {
    inputRef.current?.blur();
    setQuery('');
    setTab('articles');
    setMode('explore');
  }, []);

  const backToTyping = useCallback(() => {
    setMode('typing');
    inputRef.current?.focus();
  }, []);

  const submit = (q: string) => {
    if (!q.trim()) return;
    setQuery(q);
    if (tab === 'profiles') {
      inputRef.current?.blur();
      return;
    }
    inputRef.current?.blur();
    setMode('results');
  };

  // Android back: results → suggestions → Explore.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (mode === 'results') {
          backToTyping();
          return true;
        }
        if (mode === 'typing') {
          exit();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [mode, backToTyping, exit]),
  );

  const q = query.trim();
  const suggestions = useMemo(() => {
    if (!q) return [];
    const ql = q.toLowerCase();
    const found = SEARCH_SUGGESTIONS.filter((s) => s.toLowerCase().startsWith(ql));
    return found.length ? found : [q];
  }, [q]);
  const mockProfiles = useMemo(() => {
    const ts = tokens(q);
    if (!ts.length) return [];
    return SEARCH_PROFILES.filter((p) => ts.some((t) => p.username.includes(t.slice(0, 4)) || p.subtitle.toLowerCase().includes(t)));
  }, [q]);
  // Real accounts from the backend first; mock authors (the feed is still mock) after them.
  const [apiProfiles, setApiProfiles] = useState<Author[]>([]);
  useEffect(() => {
    if (!q) return setApiProfiles([]);
    let alive = true;
    const t = setTimeout(() => {
      searchUsers(q)
        .then((users) => alive && setApiProfiles(users))
        .catch(() => {});
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);
  const profiles = useMemo(() => {
    const seen = new Set(apiProfiles.map((p) => p.username));
    return [...apiProfiles, ...mockProfiles.filter((p) => !seen.has(p.username))];
  }, [apiProfiles, mockProfiles]);
  const results = useMemo(() => {
    const ts = tokens(q);
    const found = SEARCH_ARTICLES.filter((a) => ts.some((t) => `${a.title} ${a.lead}${a.rest}`.toLowerCase().includes(t.slice(0, 4))));
    return found.length ? found : SEARCH_ARTICLES;
  }, [q]);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top - STATUS_OVERLAP, 0) }]}>
      <View style={styles.clip}>
      <Animated.View collapsable={false} pointerEvents={mode === 'explore' ? 'none' : 'auto'} style={[styles.header, headerStyle]}>
        <Animated.View collapsable={false} style={[styles.back, backStyle]} pointerEvents={mode === 'results' ? 'auto' : 'none'}>
          <PressableScale onPress={backToTyping} hitSlop={14} scaleTo={0.85} accessibilityLabel="Back">
            <Icon name="searchBack" width={10} height={20} />
          </PressableScale>
        </Animated.View>

        <Animated.View collapsable={false} style={[styles.field, fieldStyle]}>
          <Icon name="searchFieldThin" width={16.6} style={styles.fieldIcon} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onFocus={() => mode !== 'typing' && setMode('typing')}
            onSubmitEditing={() => submit(query)}
            placeholder={mode === 'explore' ? 'Search' : undefined}
            placeholderTextColor={PLACEHOLDER}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={colors.primary}
            cursorColor={colors.text}
            style={styles.input}
            accessibilityLabel="Search"
          />
          {query && mode !== 'explore' ? (
            <Animated.View collapsable={false} entering={FADE_IN} exiting={FADE_OUT}>
              <PressableScale
                onPress={() => {
                  setQuery('');
                  if (mode === 'results') backToTyping();
                }}
                hitSlop={10}
                scaleTo={0.85}
                accessibilityLabel="Clear search"
                style={styles.clear}>
                <Icon name="searchClear" width={16} />
              </PressableScale>
            </Animated.View>
          ) : null}
        </Animated.View>

        <Animated.View collapsable={false} style={[styles.exit, exitStyle]} pointerEvents={mode === 'explore' ? 'none' : 'auto'}>
          <PressableScale onPress={exit} hitSlop={12} scaleTo={0.92} accessibilityRole="button">
            <Text style={styles.exitText}>Exit</Text>
          </PressableScale>
        </Animated.View>
      </Animated.View>

      <View style={styles.body}>
        {mode === 'explore' ? (
          <Animated.View collapsable={false} entering={FADE_IN} exiting={FADE_OUT} style={styles.exploreLayer}>
            {/* The list runs behind the header and the topics; both are overlays moved by the scroll. */}
            <Animated.FlatList
              ref={feedRef}
              data={EXPLORE_FEED}
              keyExtractor={(p) => p.id}
              renderItem={renderCard}
              onScroll={onScroll}
              // Cards are ~320pt tall: a few per batch is plenty and keeps the JS thread free while scrolling.
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              windowSize={7}
              scrollEventThrottle={16}
              // The header covers the list's top: on iOS an inset keeps the refresh spinner under it, Android uses padding + progressViewOffset.
              contentInset={Platform.OS === 'ios' ? { top: FEED_TOP } : undefined}
              contentOffset={Platform.OS === 'ios' ? { x: 0, y: -FEED_TOP } : undefined}
              scrollIndicatorInsets={Platform.OS === 'ios' ? { top: FEED_TOP } : undefined}
              automaticallyAdjustContentInsets={false}
              contentContainerStyle={Platform.OS === 'android' ? styles.feedContent : undefined}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.textMuted}
                  colors={[colors.textMuted]}
                  progressViewOffset={FEED_TOP}
                />
              }
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            />
            <Animated.View collapsable={false} style={[styles.bar, barShift]}>
              <Topics selected={topic} onSelect={setTopic} />
              <PressableScale haptic onPress={openSearch} hitSlop={12} accessibilityRole="button" accessibilityLabel="Search" style={styles.barSearch}>
                <Icon name="exploreSearch" width={24} />
              </PressableScale>
            </Animated.View>
          </Animated.View>
        ) : null}

        {mode === 'typing' ? (
          <Animated.View collapsable={false} entering={FADE_IN} exiting={FADE_OUT} style={StyleSheet.absoluteFill}>
            <Segmented tab={tab} onChange={setTab} width={W} />
            {tab === 'articles' ? (
              <FlatList
                key="suggestions"
                data={suggestions}
                keyExtractor={(s) => s}
                renderItem={({ item }) => <SuggestionRow text={item} typed={q} onPress={() => submit(item)} />}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.suggestionsList}
              />
            ) : (
              <FlatList
                key="profiles"
                data={profiles}
                keyExtractor={(p) => p.username}
                renderItem={({ item }) => <ProfileRow profile={item} />}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.profilesList}
              />
            )}
          </Animated.View>
        ) : null}

        {mode === 'results' ? (
          <Animated.View collapsable={false} entering={FADE_IN} exiting={FADE_OUT} style={StyleSheet.absoluteFill}>
            <FlatList
              data={results}
              keyExtractor={(p) => p.id}
              renderItem={renderCard}
              contentContainerStyle={styles.resultsList}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        ) : null}
      </View>
      </View>
    </View>
  );
}

const renderCard = ({ item }: { item: ExplorePost }) => <ExploreCard post={item} />;

function Topics({ selected, onSelect }: { selected: string; onSelect: (t: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics} style={styles.topicsScroll}>
      {EXPLORE_TOPICS.map((t) => (
        <Chip key={t} label={t} active={selected === t} onPress={() => onSelect(t)} />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  // The fill and the text colour cross-fade when the topic changes.
  const on = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [active, on]);
  const fill = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(on.value, [0, 1], [CHIP_BG, CHIP_ACTIVE]) }));
  const text = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], [colors.text, '#FFFFFF']) }));
  return (
    <PressableScale
      haptic={!active}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={TOPIC_W[label] ? { width: TOPIC_W[label] } : null}>
      <Animated.View collapsable={false} style={[styles.chip, TOPIC_W[label] ? { paddingHorizontal: 0 } : null, fill]}>
        <AnimatedText style={[styles.chipText, text]}>{label}</AnimatedText>
      </Animated.View>
    </PressableScale>
  );
}

function Segmented({ tab, onChange, width }: { tab: Tab; onChange: (t: Tab) => void; width: number }) {
  const segW = (width - SEG_SIDE_L - SEG_SIDE_R - SEG_GAP) / 2;
  const x = useSharedValue(tab === 'articles' ? 0 : 1);
  useEffect(() => {
    x.value = withTiming(tab === 'articles' ? 0 : 1, EASE);
  }, [tab, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (segW + SEG_GAP) }] }));
  const articlesText = useAnimatedStyle(() => ({ color: interpolateColor(x.value, [0, 1], ['#FFFFFF', MUTED]) }));
  const profilesText = useAnimatedStyle(() => ({ color: interpolateColor(x.value, [0, 1], [MUTED, '#FFFFFF']) }));

  return (
    <View style={styles.segmented}>
      <View style={[styles.segment, { width: segW }]} />
      <View style={[styles.segment, { width: segW }]} />
      <Animated.View collapsable={false} style={[styles.segment, styles.segIndicator, { width: segW }, indicator]} />
      <Pressable style={[styles.segHit, { width: segW }]} onPress={() => onChange('articles')} accessibilityRole="tab" accessibilityState={{ selected: tab === 'articles' }}>
        <AnimatedText style={[styles.segText, articlesText]}>Articles</AnimatedText>
      </Pressable>
      <Pressable
        style={[styles.segHit, { width: segW, left: segW + SEG_GAP }]}
        onPress={() => onChange('profiles')}
        accessibilityRole="tab"
        accessibilityState={{ selected: tab === 'profiles' }}>
        <AnimatedText style={[styles.segText, profilesText]}>Profiles</AnimatedText>
      </Pressable>
    </View>
  );
}

function SuggestionRow({ text, typed, onPress }: { text: string; typed: string; onPress: () => void }) {
  const n = text.toLowerCase().startsWith(typed.toLowerCase()) ? typed.length : 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={text}>
      <Icon name="searchSuggestion" width={30} style={styles.suggestionIcon} />
      <Text style={styles.suggestionText} numberOfLines={1}>
        {text.slice(0, n)}
        <Text style={styles.suggestionBold}>{text.slice(n)}</Text>
      </Text>
    </Pressable>
  );
}

function ProfileRow({ profile }: { profile: Author }) {
  return (
    <Pressable
      onPress={() => push(`/user/${encodeURIComponent(profile.username)}` as Href)}
      style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={profile.username}>
      {profile.avatar ? <Image source={profile.avatar} style={styles.profileAvatar} transition={150} /> : <View style={styles.profileAvatar} />}
      <View>
        <Text style={styles.profileName}>{profile.username}</Text>
        <Text style={styles.profileSub}>{profile.subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: FIELD_TOP + FIELD_H + HEADER_BOTTOM, paddingTop: FIELD_TOP, zIndex: 1, backgroundColor: colors.bg },
  back: { position: 'absolute', left: 15, top: FIELD_TOP + 11 },
  field: {
    height: FIELD_H,
    borderRadius: 10,
    backgroundColor: FIELD_BG,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10.6,
    paddingRight: 8,
  },
  fieldIcon: { marginRight: 12.9, transform: [{ translateY: 0.5 }] }, // icon 16.6 (1.1x the frame); placeholder stays at x 51.6
  input: { flex: 1, fontSize: 16, color: colors.text, padding: 0, height: FIELD_H, transform: [{ translateY: 1.5 }] },
  clear: { marginLeft: 8 },
  exit: { position: 'absolute', right: 24, top: FIELD_TOP + 11 },
  exitText: { fontSize: 16, lineHeight: 20, color: colors.text },
  body: { flex: 1 },
  clip: { flex: 1, overflow: 'hidden' },
  exploreLayer: { position: 'absolute', top: -HEADER_H, left: 0, right: 0, bottom: 0 },
  feedContent: { paddingTop: FEED_TOP },
  // White behind the bar so posts scrolling back under it don't show through; it ends 10 above the first post.
  bar: { position: 'absolute', top: 0, left: 0, right: 0, height: FEED_TOP - 10, backgroundColor: colors.bg },
  barSearch: { position: 'absolute', left: 349, top: BAR_TOP + 1 },

  // Frame 1081: tabs 30 tall with radius 7, 10 apart from x 8; active #455DFF with white text, the rest #F2F2F2.
  topicsScroll: { marginTop: BAR_TOP, flexGrow: 0, marginRight: 390 - 340 },
  topics: { paddingHorizontal: 8, gap: 10 },
  chip: {
    height: 30,
    paddingHorizontal: 15,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13.5, lineHeight: 17, fontWeight: '600', color: colors.text },

  segmented: { height: 28, marginTop: 15 - HEADER_BOTTOM, marginLeft: SEG_SIDE_L, marginRight: SEG_SIDE_R, flexDirection: 'row', gap: SEG_GAP },
  segment: { height: 28, borderRadius: 6, backgroundColor: FIELD_BG },
  segIndicator: { position: 'absolute', left: 0, top: 0, backgroundColor: colors.primary },
  segHit: { position: 'absolute', top: 0, left: 0, height: 28, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 13, lineHeight: 16, fontWeight: '600' },

  suggestionsList: { paddingTop: 14 },
  suggestion: { height: 55, flexDirection: 'row', alignItems: 'center', paddingLeft: 18 },
  suggestionIcon: { marginRight: 25 },
  suggestionText: { flex: 1, fontSize: 14, lineHeight: 18, color: colors.text, paddingRight: 16 },
  suggestionBold: { fontWeight: '700' },
  pressed: { backgroundColor: PRESSED },

  profilesList: { paddingTop: 16 },
  profile: { height: 64, flexDirection: 'row', alignItems: 'center', paddingLeft: 15, gap: 13 },
  profileAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceSoft },
  profileName: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: colors.text },
  profileSub: { fontSize: 12, lineHeight: 15, color: MUTED },

  resultsList: { paddingTop: 15 - HEADER_BOTTOM },
});
