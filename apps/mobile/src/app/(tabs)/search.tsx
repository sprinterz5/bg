import { Image } from 'expo-image';
import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
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
import { EXPLORE_FEED, EXPLORE_TOPICS, SEARCH_ARTICLES, SEARCH_PROFILES, SEARCH_SUGGESTIONS, type Author } from '@/mock/data';
import { colors, motion } from '@/theme';
import { push } from '@/lib/nav';

// Figma: Explore 3163:1520, search focused 3154:579, suggestions 3158:793 / 3160:1291,
// profile results 3159:1041, article results 3170:2017. Design status bar = 47.
type Mode = 'explore' | 'typing' | 'results';
type Tab = 'articles' | 'profiles';

const FIELD_TOP = 6; // y 55 in the frame, 2px higher by eye
const FIELD_H = 37;
// White strip under the fixed field so scrolling content doesn't cut right at its edge; offsets below are reduced by it.
const HEADER_BOTTOM = 8;
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

  // Field: x 11.5..326.5 (explore, THIS.svg) → 15..325 (typing, "Exit" on the right) → 44..325 (results, back chevron on the left).
  const fieldStyle = useAnimatedStyle(() => ({
    marginLeft: interpolate(m.value, [0, 1, 2], [11.5, 15, 44]),
    marginRight: interpolate(m.value, [0, 1, 2], [63.5, 65, 65]),
  }));
  const filterStyle = useAnimatedStyle(() => ({ opacity: interpolate(m.value, [0, 1], [1, 0], Extrapolation.CLAMP) }));
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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Animated.View style={[styles.back, backStyle]} pointerEvents={mode === 'results' ? 'auto' : 'none'}>
          <PressableScale onPress={backToTyping} hitSlop={14} scaleTo={0.85} accessibilityLabel="Back">
            <Icon name="searchBack" width={10} height={20} />
          </PressableScale>
        </Animated.View>

        <Animated.View style={[styles.field, fieldStyle]}>
          <Icon name="searchField" width={15} style={styles.fieldIcon} />
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

        <Animated.View style={[styles.filter, filterStyle]} pointerEvents={mode === 'explore' ? 'auto' : 'none'}>
          <PressableScale hitSlop={10} scaleTo={0.88} accessibilityLabel="Filters">
            <Icon name="searchFilter" width={26} height={24} />
          </PressableScale>
        </Animated.View>

        <Animated.View style={[styles.exit, exitStyle]} pointerEvents={mode === 'explore' ? 'none' : 'auto'}>
          <PressableScale onPress={exit} hitSlop={12} scaleTo={0.92} accessibilityRole="button">
            <Text style={styles.exitText}>Exit</Text>
          </PressableScale>
        </Animated.View>
      </View>

      <View style={styles.body}>
        {mode === 'explore' ? (
          <Animated.View collapsable={false} entering={FADE_IN} exiting={FADE_OUT} style={StyleSheet.absoluteFill}>
            {/* Topics stay pinned under the search field; only the posts scroll. */}
            <Topics selected={topic} onSelect={setTopic} />
            <FlatList
              data={EXPLORE_FEED}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => <ExploreCard post={item} />}
              style={styles.feed}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} colors={[colors.textMuted]} />
              }
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            />
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
              renderItem={({ item }) => <ExploreCard post={item} />}
              contentContainerStyle={styles.resultsList}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function Topics({ selected, onSelect }: { selected: string; onSelect: (t: string) => void }) {
  const [first, ...rest] = EXPLORE_TOPICS;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics} style={styles.topicsScroll}>
      <Chip label={first} active={selected === first} onPress={() => onSelect(first)} />
      <PressableScale scaleTo={0.92} accessibilityLabel="Add topics" style={[styles.chip, styles.plusChip]}>
        <Icon name="chipPlus" width={14} />
      </PressableScale>
      {rest.map((t) => (
        <Chip key={t} label={t} active={selected === t} onPress={() => onSelect(t)} />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale
      haptic={!active}
      scaleTo={0.94}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
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
      <Animated.View style={[styles.segment, styles.segIndicator, { width: segW }, indicator]} />
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
  back: { position: 'absolute', left: 15, top: FIELD_TOP + 9 },
  field: {
    height: FIELD_H,
    borderRadius: 10,
    backgroundColor: FIELD_BG,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10.6,
    paddingRight: 8,
  },
  fieldIcon: { marginRight: 14.5 }, // placeholder at x 51.6
  input: { flex: 1, fontSize: 15.25, color: colors.text, padding: 0, height: FIELD_H },
  clear: { marginLeft: 8 },
  filter: { position: 'absolute', right: 20.5, top: 15 },
  exit: { position: 'absolute', right: 24, top: FIELD_TOP + 9 },
  exitText: { fontSize: 16, lineHeight: 20, color: colors.text },
  body: { flex: 1 },
  feed: { flex: 1 },

  // THIS.svg: chips 28 tall at y 107 (15 under the field), 9 apart from x 11; cards start 15 below.
  topicsScroll: { marginTop: 15 - HEADER_BOTTOM, marginBottom: 15, flexGrow: 0 },
  topics: { paddingHorizontal: 11, gap: 9 },
  chip: {
    height: 28,
    paddingHorizontal: 14.5, // text 15.5 from the outer edge
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF0F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: FIELD_BG, borderColor: FIELD_BG },
  plusChip: { width: 42, paddingHorizontal: 0 },
  chipText: { fontSize: 13, lineHeight: 16, letterSpacing: -0.13, fontWeight: '600', color: colors.text },
  chipTextActive: { fontWeight: '700' },

  segmented: { height: 28, marginTop: 17 - HEADER_BOTTOM, marginLeft: SEG_SIDE_L, marginRight: SEG_SIDE_R, flexDirection: 'row', gap: SEG_GAP },
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

  resultsList: { paddingTop: 17 - HEADER_BOTTOM },
});
