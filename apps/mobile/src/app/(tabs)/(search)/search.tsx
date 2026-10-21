import { Image } from 'expo-image';
import { useFocusEffect, useScrollToTop, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, FlatList, Pressable, RefreshControl, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appear } from '@/lib/appear';
import { ExploreCard } from '@/components/explore-card';
import { ExploreRow } from '@/components/explore-row';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { AnimatedText, INTER_FAMILIES, Text, TextInput } from '@/components/text';
import { searchUsers } from '@/lib/users';
import { EXPLORE_FEED, EXPLORE_TOPICS, QUICK_RESULTS, RESULT_TABS, SEARCH_ARTICLES, SEARCH_PROFILES, SEARCH_SUGGESTIONS, type Author, type ExplorePost } from '@/mock/data';
import { colors, motion } from '@/theme';
import { push } from '@/lib/nav';

// Frame 1198. Explore: a search field (16.5..373.5, 40 tall) over topic tabs with an underline and a list of
// article rows. Typing: the field narrows to 14..324 (38 tall) with "Exit", Articles / Profiles under it.
// Results: back chevron, the field at 44.5..328.5, "Exit", tabs Related / Detailed / Quick over the rows
// (Quick shows the big picture cards). All y here are from the bottom of the status bar (design y - 47).
type Mode = 'explore' | 'typing' | 'results';
type SegTab = 'articles' | 'profiles';

const MODE_VALUE: Record<Mode, number> = { explore: 0, typing: 1, results: 2 };
// Field per mode: [explore, typing, results].
const FIELD_L = [16.5, 14, 44.5];
const FIELD_R = [373.5, 324, 328.5];
const FIELD_TOP = [5, 6, 5];
const FIELD_H = [40, 38, 40];
const ICON_L = [11.1, 9.6, 11.1]; // magnifier box (13.8 with its stroke) from the field's left edge
const TEXT_L = [39, 39, 36.1]; // text from the field's left edge
const FIELD_BG = '#F5F5F5';
const GRAY = '#999999';
// Tabs: Inter Medium 14/16, line top 64.9; a 0.75 hairline at 97 with a 36-wide underline under the active tab
// (AutoLayouted-15). On results (AutoLayouted-16) tabs, line and list sit 2 lower.
const TABS_TOP = 64.9;
const LINE_TOP = 97;
const RESULTS_SHIFT = 2;
const LIST_TOP = LINE_TOP + 0.75;
const EXPLORE_TAB_X = [22.4, 103.4, 175.1, 249.2];
const RESULT_TAB_X = [22.4, 104.6, 196.2];
const UNDERLINE_W = 36;
const SEG_TOP = 61;
const SEG_SIDE_L = 14;
const SEG_SIDE_R = 20;
const SEG_GAP = 4;
const MUTED = '#999999';
const PRESSED = '#F5F5F5';
const EASE = { duration: motion.base, easing: Easing.out(Easing.cubic) };
// Field changing shape between modes: quick start, long soft landing, no overshoot.
const FIELD_EASE = { duration: 320, easing: Easing.bezier(0.2, 0, 0, 1) };
const FADE_IN = FadeIn.duration(220);
const FADE_OUT = FadeOut.duration(140);

function tokens(q: string) {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

export default function Search() {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);
  // Tapping the Search tab again scrolls Explore back to the top.
  const feedRef = useRef<FlatList<ExplorePost>>(null);
  const scrollTarget = useMemo(() => ({ current: { scrollToTop: () => feedRef.current?.scrollToOffset({ offset: 0, animated: true }) } }), []);
  useScrollToTop(scrollTarget);
  const [mode, setMode] = useState<Mode>('explore');
  const [segTab, setSegTab] = useState<SegTab>('articles');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState(0);
  const [resultTab, setResultTab] = useState(0);
  // Feed is still mock: the pull-to-refresh only shows the spinner.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const m = useSharedValue(0);
  useEffect(() => {
    m.set(withTiming(MODE_VALUE[mode], FIELD_EASE));
  }, [mode, m]);
  const pick = (values: number[], v: number) => {
    'worklet';
    return interpolate(v, [0, 1, 2], values);
  };
  const fieldStyle = useAnimatedStyle(() => {
    const left = pick(FIELD_L, m.value);
    return { left, width: pick(FIELD_R, m.value) - left, top: pick(FIELD_TOP, m.value), height: pick(FIELD_H, m.value) };
  });
  const fieldIconStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pick(ICON_L, m.value) }] }));
  const inputStyle = useAnimatedStyle(() => ({ left: pick(TEXT_L, m.value) }));
  // "Exit": hidden on Explore; at x 340.8 while typing, 341.8 on results.
  const exitStyle = useAnimatedStyle(() => ({
    opacity: interpolate(m.value, [0, 1], [0, 1], 'clamp'),
    transform: [{ translateX: interpolate(m.value, [0, 1, 2], [10, 0, 1]) }, { translateY: interpolate(m.value, [1, 2], [0, 1], 'clamp') }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(m.value, [1, 2], [0, 1], 'clamp'),
    transform: [{ translateX: interpolate(m.value, [1, 2], [-8, 0], 'clamp') }],
  }));

  const openSearch = useCallback(() => {
    setMode('typing');
    inputRef.current?.focus();
  }, []);

  const exit = useCallback(() => {
    inputRef.current?.blur();
    setQuery('');
    setSegTab('articles');
    setMode('explore');
  }, []);

  const backToTyping = useCallback(() => {
    setMode('typing');
    inputRef.current?.focus();
  }, []);

  const submit = (q: string) => {
    if (!q.trim()) return;
    setQuery(q);
    inputRef.current?.blur();
    if (segTab === 'profiles') return;
    setResultTab(0);
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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.body}>
        {mode === 'explore' ? (
          <Animated.View collapsable={false} entering={FADE_IN} exiting={FADE_OUT} style={StyleSheet.absoluteFill}>
            <View style={styles.listLayer}>
              <FlatList
                ref={feedRef}
                data={EXPLORE_FEED}
                keyExtractor={(p) => p.id}
                renderItem={renderRow}
                contentContainerStyle={styles.rowsContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} colors={[colors.textMuted]} />}
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              />
            </View>
            <Tabs labels={EXPLORE_TOPICS} xs={EXPLORE_TAB_X} selected={topic} onSelect={setTopic} />
          </Animated.View>
        ) : null}

        {mode === 'typing' ? (
          <Animated.View collapsable={false} entering={FADE_IN} exiting={FADE_OUT} style={styles.typingLayer}>
            <Segmented tab={segTab} onChange={setSegTab} width={W} />
            {segTab === 'articles' ? (
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
          <Animated.View collapsable={false} entering={FADE_IN} exiting={FADE_OUT} style={[StyleSheet.absoluteFill, { top: RESULTS_SHIFT }]}>
            <View style={styles.listLayer}>
              {RESULT_TABS[resultTab] === 'Quick' ? (
                <FlatList key="quick" data={QUICK_RESULTS} keyExtractor={(p) => p.id} renderItem={renderCard} contentContainerStyle={styles.cardsContent} showsVerticalScrollIndicator={false} />
              ) : (
                <FlatList key="rows" data={results} keyExtractor={(p) => p.id} renderItem={renderRow} contentContainerStyle={styles.rowsContent} showsVerticalScrollIndicator={false} />
              )}
            </View>
            <Tabs labels={RESULT_TABS} xs={RESULT_TAB_X} selected={resultTab} onSelect={setResultTab} />
          </Animated.View>
        ) : null}

        {/* Field, back and Exit sit over every mode and change shape between them. */}
        <Animated.View collapsable={false} pointerEvents={mode === 'results' ? 'auto' : 'none'} style={[styles.back, backStyle]}>
          <PressableScale onPress={backToTyping} hitSlop={14} scaleTo={0.85} accessibilityLabel="Back">
            <Icon name="searchBack" width={13} height={23} />
          </PressableScale>
        </Animated.View>

        <Animated.View collapsable={false} style={[styles.field, fieldStyle]}>
          <Animated.View collapsable={false} style={[styles.fieldIcon, fieldIconStyle]}>
            <Icon name="exploreFieldSearch" width={13.76} height={13.74} tintColor={mode === 'explore' ? '#999999' : '#6B6B6B'} />
          </Animated.View>
          <Animated.View collapsable={false} style={[styles.inputBox, inputStyle]}>
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onFocus={() => mode !== 'typing' && setMode('typing')}
              onSubmitEditing={() => submit(query)}
              returnKeyType="search"
              autoCorrect={false}
              cursorColor={colors.text}
              style={styles.input}
              accessibilityLabel="Search"
            />
            {mode === 'explore' && !query ? (
              <Text pointerEvents="none" style={styles.placeholder}>
                Search
              </Text>
            ) : null}
          </Animated.View>
          {mode === 'explore' ? (
            // The whole field opens the search, not just its text.
            <Pressable onPress={openSearch} style={StyleSheet.absoluteFill} accessibilityRole="search" accessibilityLabel="Search" />
          ) : null}
          {query && mode !== 'explore' ? (
            <Animated.View collapsable={false} entering={FADE_IN} exiting={FADE_OUT} style={[styles.clear, mode === 'results' && styles.clearResults]}>
              <PressableScale
                onPress={() => {
                  setQuery('');
                  if (mode === 'results') backToTyping();
                }}
                hitSlop={10}
                scaleTo={0.85}
                accessibilityLabel="Clear search">
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
      </View>
    </View>
  );
}

// rows and cards rise in one after another when a list shows up
const renderRow = ({ item, index }: { item: ExplorePost; index: number }) => (
  <Animated.View collapsable={false} entering={appear(index)}>
    <ExploreRow post={item} />
  </Animated.View>
);
const renderCard = ({ item, index }: { item: ExplorePost; index: number }) => (
  <Animated.View collapsable={false} entering={appear(index)}>
    <ExploreCard post={item} />
  </Animated.View>
);

/** Text tabs with a 36-wide underline that slides to the selected one (the slide is not in the design). */
function Tabs({ labels, xs, selected, onSelect }: { labels: readonly string[]; xs: number[]; selected: number; onSelect: (i: number) => void }) {
  // Underline centred under the label (measured), 1.5 left of centre as in the frame.
  const [centers, setCenters] = useState<number[]>(() => labels.map((l, i) => xs[i] + l.length * 3.5));
  const at = useSharedValue(centers[selected] - UNDERLINE_W / 2 - 1.5);
  useEffect(() => {
    at.set(withTiming(centers[selected] - UNDERLINE_W / 2 - 1.5, EASE));
  }, [selected, centers, at]);
  const underline = useAnimatedStyle(() => ({ transform: [{ translateX: at.value }] }));
  const measure = (i: number) => (e: LayoutChangeEvent) => {
    const c = xs[i] + e.nativeEvent.layout.width / 2;
    setCenters((cs) => (cs[i] === c ? cs : cs.map((v, j) => (j === i ? c : v))));
  };
  return (
    <View style={styles.tabs} pointerEvents="box-none">
      {labels.map((label, i) => (
        <Pressable key={label} onPress={() => onSelect(i)} hitSlop={12} accessibilityRole="tab" accessibilityState={{ selected: i === selected }} style={[styles.tab, { left: xs[i] }]}>
          <Text onLayout={measure(i)} style={[styles.tabText, i === selected && styles.tabActive]}>
            {label}
          </Text>
        </Pressable>
      ))}
      <View style={styles.tabLine} />
      <Animated.View collapsable={false} style={[styles.underline, underline]} />
    </View>
  );
}

function Segmented({ tab, onChange, width }: { tab: SegTab; onChange: (t: SegTab) => void; width: number }) {
  const segW = (width - SEG_SIDE_L - SEG_SIDE_R - SEG_GAP) / 2;
  const x = useSharedValue(tab === 'articles' ? 0 : 1);
  useEffect(() => {
    x.set(withTiming(tab === 'articles' ? 0 : 1, EASE));
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
  body: { flex: 1 },
  listLayer: { position: 'absolute', top: LIST_TOP, left: 0, right: 0, bottom: 0 },
  rowsContent: { paddingTop: 2.5, paddingBottom: 24 },
  cardsContent: { paddingTop: 15, paddingBottom: 24 },
  typingLayer: { position: 'absolute', top: SEG_TOP, left: 0, right: 0, bottom: 0 },

  field: { position: 'absolute', borderRadius: 10, backgroundColor: FIELD_BG, overflow: 'hidden' },
  fieldIcon: { position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' },
  inputBox: { position: 'absolute', top: 0, bottom: 0, right: 30, justifyContent: 'center' },
  // Query: Inter 15/23 (results "Steve Jobs"); Explore's placeholder: Inter 14 #999.
  input: { fontFamily: INTER_FAMILIES['400'], fontSize: 15, lineHeight: 20, letterSpacing: 15 * -0.01, color: colors.text, padding: 0, height: 38 },
  placeholder: { position: 'absolute', left: 0, fontFamily: INTER_FAMILIES['400'], fontSize: 14, lineHeight: 23, letterSpacing: 14 * -0.01, color: GRAY },
  clear: { position: 'absolute', right: 7, top: 0, bottom: 0, justifyContent: 'center' },
  clearResults: { right: 9 },
  back: { position: 'absolute', left: 16, top: 14 },
  exit: { position: 'absolute', left: 340.2, top: 12.4 },
  exitText: { fontFamily: INTER_FAMILIES['500'], fontSize: 14.4, lineHeight: 23, color: colors.text },

  tabs: { position: 'absolute', top: 0, left: 0, right: 0, height: LIST_TOP },
  tab: { position: 'absolute', top: TABS_TOP },
  tabText: { fontFamily: INTER_FAMILIES['500'], fontSize: 13.5, lineHeight: 16, letterSpacing: 0, color: GRAY },
  tabActive: { color: colors.text },
  tabLine: { position: 'absolute', top: LINE_TOP, left: 0, right: 0, height: 0.75, backgroundColor: '#E5E5E5' },
  underline: { position: 'absolute', top: LINE_TOP, left: 0, width: UNDERLINE_W, height: 0.75, backgroundColor: '#000000' },

  // Frame 1198 typing: Articles / Profiles 176x28 (radius 7) at x 14 and 194, y 62.
  segmented: { height: 28, marginLeft: SEG_SIDE_L, marginRight: SEG_SIDE_R, flexDirection: 'row', gap: SEG_GAP },
  // Inactive segment: white with a #D9D9D9 border, #999 text; the active one black (AutoLayouts BG(1)).
  segment: { height: 28, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9D9D9' },
  segIndicator: { position: 'absolute', left: 0, top: 0, backgroundColor: '#000000', borderColor: '#000000' },
  segHit: { position: 'absolute', top: 0, left: 0, height: 28, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 13.4, lineHeight: 16, fontWeight: '600' },

  // AutoLayouted-7: the 30px icon box at x 14, rows 57 apart from y 148.5, text at 68.1.
  suggestionsList: { paddingTop: 12.5 },
  suggestion: { height: 57, flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  suggestionIcon: { marginRight: 24.1 },
  suggestionText: { flex: 1, fontSize: 14, lineHeight: 18, color: colors.text, paddingRight: 16 },
  suggestionBold: { fontWeight: '700' },
  pressed: { backgroundColor: PRESSED },

  profilesList: { paddingTop: 16 },
  // AutoLayouted-8: avatar 46 at x 14, names Inter 13.25 semibold / 12.3.
  profile: { height: 64, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, gap: 13 },
  profileAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceSoft },
  profileName: { fontFamily: INTER_FAMILIES['700'], fontSize: 12.7, lineHeight: 16, color: colors.text },
  profileSub: { fontFamily: INTER_FAMILIES['300'], fontSize: 12.4, lineHeight: 15, color: MUTED },
});
