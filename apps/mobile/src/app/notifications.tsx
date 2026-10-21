import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { appear } from '@/lib/appear';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { RollingLabel } from '@/components/rolling-label';
import { INTER_FAMILIES, Text } from '@/components/text';
import { back, openProfile, push } from '@/lib/nav';
import { CAPTURE } from '@/lib/capture';
import { fetchNotices, markAllRead, type NoticeSection } from '@/lib/notifications';
import { setFollow } from '@/lib/users';
import { NOTIFICATIONS, type Notice } from '@/mock/data';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// AutoLayouted-37. Title = own username; rows step 73 (avatar 53 + 20); section titles 37 above the first row.
// Header stays put, the sections scroll under it.
const MUTED = '#999999';

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  // From the server (?capture: the design's mock list); opening the screen marks everything read.
  const [sections, setSections] = useState<NoticeSection[] | null>(CAPTURE ? NOTIFICATIONS : null);
  const [following, setFollowing] = useState<Record<string, boolean>>(() =>
    CAPTURE ? Object.fromEntries(NOTIFICATIONS.flatMap((s) => s.items).map((n) => [n.id, !!n.follow])) : {},
  );
  useEffect(() => {
    if (CAPTURE) return;
    fetchNotices()
      .then((list) => {
        setSections(list);
        setFollowing(Object.fromEntries(list.flatMap((s) => s.items).map((n) => [n.id, !!n.follow])));
        markAllRead();
      })
      .catch(() => setSections([]));
  }, []);
  const toggle = (n: (typeof NOTIFICATIONS)[number]['items'][number]) => {
    const next = !following[n.id];
    setFollowing((f) => ({ ...f, [n.id]: next }));
    if (n.userId) setFollow(n.userId, next).catch(() => setFollowing((f) => ({ ...f, [n.id]: !next })));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => back()} hitSlop={12} scaleTo={0.85} accessibilityLabel="Back" style={styles.back}>
          <Icon name="notifBack" width={14.11} height={24.4} />
        </PressableScale>
        <Text style={styles.title} numberOfLines={1}>
          {user?.username ?? 'Notifications'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 12.82, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {sections === null ? <ActivityIndicator style={styles.loading} color={MUTED} /> : null}
        {sections && !sections.length ? <Text style={styles.empty}>Likes, comments and new followers will show up here.</Text> : null}
        {(sections ?? []).map((section, i) => (
          // rows rise in one after another across the sections
          <View key={section.title} style={i > 0 && styles.sectionGap}>
            <Text style={styles.section}>{section.title}</Text>
            {section.items.map((n, k) => (
              <Animated.View key={n.id} collapsable={false} entering={appear((sections ?? []).slice(0, i).reduce((sum, s) => sum + s.items.length, 0) + k)}>
                <Row
                  item={n}
                  muted={section.muted}
                  following={following[n.id]}
                  onToggle={() => toggle(n)}
                />
              </Animated.View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Row({ item, muted, following, onToggle }: { item: Notice; muted?: boolean; following?: boolean; onToggle: () => void }) {
  const [first, second] = item.avatars;
  return (
    <View style={[styles.row, second ? styles.rowPair : null]}>
      <PressableScale
        scaleTo={0.98}
        onPress={() => (item.articleId ? push(`/article/${item.articleId}`) : openProfile(item.username, true))}
        style={styles.person}
        accessibilityRole="button"
        accessibilityLabel={`${item.who} ${item.what}`}>
        {second ? (
          <View style={styles.avatar}>
            <Image source={first} style={styles.pair} />
            <Image source={second} style={[styles.pair, styles.pairBack]} />
          </View>
        ) : (
          <Image source={first} style={styles.avatar} transition={150} />
        )}
        <View style={styles.texts}>
          <Text style={[styles.who, muted && styles.whoSuggestion]} numberOfLines={1}>
            {item.who}
          </Text>
          <Text style={[styles.what, muted && styles.whatSuggestion]} numberOfLines={1}>
            {item.what}
          </Text>
        </View>
      </PressableScale>
      {item.thumb ? (
        <Image source={item.thumb} style={styles.thumb} transition={150} />
      ) : item.follow !== undefined ? (
        <PressableScale haptic onPress={onToggle} scaleTo={0.94} style={[styles.button, following ? styles.buttonOff : styles.buttonOn]}>
          <RollingLabel text={following ? 'Following' : 'Follow'} style={[styles.buttonText, following && styles.buttonTextOff]} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { marginTop: 40 },
  empty: { marginTop: 60, marginHorizontal: 40, textAlign: 'center', fontFamily: INTER_FAMILIES['400'], fontSize: 14.5, lineHeight: 20, color: MUTED },
  header: { height: 61 },
  back: { position: 'absolute', left: 18.97, top: 21.81 },
  title: { position: 'absolute', left: 51, right: 16, top: 20.2, fontFamily: INTER_FAMILIES['700'], fontSize: 21.5, lineHeight: 27, color: colors.text },
  // AutoLayouted-33 (BG(2)): a section's cap top 30.8 under the previous row, its first avatar 37.2 under that.
  sectionGap: { marginTop: 4.8 },
  section: { marginLeft: 11, marginBottom: 21.6, fontFamily: INTER_FAMILIES['700'], fontSize: 16.4, lineHeight: 20, color: colors.text },
  row: { height: 53, marginBottom: 20, flexDirection: 'row', alignItems: 'center', paddingLeft: 11, paddingRight: 12 },
  // rows with two avatars sit 71 apart instead of 73
  rowPair: { marginBottom: 18 },
  person: { flex: 1, flexDirection: 'row', alignSelf: 'stretch' },
  avatar: { width: 53, height: 53, borderRadius: 26.5 },
  // Grouped actors: two 38px circles, the second 15 right / 14 down over the first.
  pair: { position: 'absolute', left: 0, top: 0, width: 38, height: 38, borderRadius: 19 },
  pairBack: { left: 15, top: 14 },
  texts: { flex: 1, marginLeft: 13, paddingTop: 10.8 },
  who: { fontFamily: INTER_FAMILIES['600'], fontSize: 13.7, lineHeight: 17, color: colors.text },
  what: { marginTop: 0.3, fontFamily: INTER_FAMILIES['400'], fontSize: 12.55, lineHeight: 15, color: colors.text },
  // Suggestions: the name in Regular 14.1, "Make a new friend" Light 12.5 #999
  whoSuggestion: { fontFamily: INTER_FAMILIES['400'], fontSize: 14.1 },
  whatSuggestion: { fontFamily: INTER_FAMILIES['300'], fontSize: 12.5, color: MUTED },
  thumb: { width: 74, height: 45, borderRadius: 5, marginLeft: 12 },
  button: { width: 103, height: 28, borderRadius: 7, overflow: 'hidden', marginLeft: 12, marginTop: 3, alignItems: 'center', justifyContent: 'center' },
  buttonOn: { backgroundColor: '#000000' },
  buttonOff: { borderWidth: 1, borderColor: '#D9D9D9' },
  buttonText: { fontFamily: INTER_FAMILIES['600'], fontSize: 13.4, lineHeight: 16, color: '#FFFFFF' },
  buttonTextOff: { fontFamily: INTER_FAMILIES['500'], fontSize: 13.1, color: MUTED },
});
