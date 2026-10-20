import { Image } from 'expo-image';
import { usePathname } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { INTER_FAMILIES, Text, TextInput } from '@/components/text';
import { CONNECTIONS, type Connection } from '@/mock/data';
import { colors } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { FollowButton } from './follow-button';
import { ConnectionRowSkeleton } from './skeleton';
import { back, openProfile } from '@/lib/nav';
import { fetchConnections, setFollow } from '@/lib/users';

// AutoLayouted-9 (Followers, Follow / Following buttons) and -10 (Following, no buttons): back at (19.5, 22.9), title
// Inter 23 bold, the field (#F5F5F5, 10 from both sides) at 67, rows 74 apart from 29 under it.
const HEADER_H = 67;
const MUTED = '#999999';

type Props = {
  title: string;
  /** Which rows get a Follow / Following button. */
  withButtons: boolean | ((c: Connection) => boolean);
  /** Replaces the default back + title header (e.g. the centred header of 3185:1524). */
  header?: ReactNode;
  /** Initial follow state per row; defaults to the mock data. */
  initialFollowing?: (c: Connection) => boolean;
  /** Load this user's real followers / following instead of the mock list. */
  source?: { username: string; kind: 'followers' | 'following' };
  /** Rows supplied by the caller (e.g. conversations); overrides mock / source. */
  items?: Connection[];
  /** Row tap; defaults to opening the profile. */
  onOpen?: (c: Connection) => void;
  /** Shown instead of the list while it is empty. */
  empty?: ReactNode;
};

export function ConnectionsScreen({ title, withButtons, header, initialFollowing, source, items, onOpen, empty }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [list, setList] = useState<Connection[]>(source ? [] : CONNECTIONS);
  const [loading, setLoading] = useState(!!source);
  const [following, setFollowing] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CONNECTIONS.map((c) => [c.username, initialFollowing ? initialFollowing(c) : c.following])),
  );

  const sourceUser = source?.username;
  const sourceKind = source?.kind;
  useEffect(() => {
    if (!sourceUser || !sourceKind) return;
    let alive = true;
    fetchConnections(sourceUser, sourceKind)
      .then((rows) => {
        if (!alive) return;
        const items = rows.map((u) => ({
          id: u.id,
          isMe: u.isMe,
          username: u.username,
          subtitle: u.displayName ?? '',
          avatar: u.avatarUrl ? { uri: u.avatarUrl } : null,
          following: u.isFollowing,
        }));
        setList(items);
        setFollowing(Object.fromEntries(items.map((c) => [c.username, c.following])));
      })
      // Mock-only author (feed is still mock) → keep the mock list.
      .catch(() => alive && setList(CONNECTIONS))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sourceUser, sourceKind]);

  const toggle = (c: Connection) => {
    const next = !following[c.username];
    setFollowing((f) => ({ ...f, [c.username]: next }));
    if (c.id) setFollow(c.id, next).catch(() => setFollowing((f) => ({ ...f, [c.username]: !next })));
  };

  const q = query.trim().toLowerCase();
  const data = useMemo(
    () => {
      const all = items ?? list;
      return q ? all.filter((c) => c.username.includes(q) || c.subtitle.toLowerCase().includes(q)) : all;
    },
    [q, list, items],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header ?? (
        <View style={styles.header}>
          <PressableScale onPress={() => back()} hitSlop={12} scaleTo={0.85} accessibilityLabel="Back" style={styles.back}>
            <Icon name="notifBack" width={11.66} height={20.15} />
          </PressableScale>
          <Text style={styles.title}>{title}</Text>
        </View>
      )}

      <View style={styles.field}>
        <Icon name="searchField" width={14.38} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={MUTED}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          cursorColor={colors.text}
          style={styles.input}
          accessibilityLabel={`Search ${title.toLowerCase()}`}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(c) => c.id ?? c.username}
        ListEmptyComponent={
          loading ? (
            <Animated.View collapsable={false} exiting={FadeOut.duration(150)}>
              {Array.from({ length: 7 }, (_, i) => (
                <ConnectionRowSkeleton key={i} button={withButtons !== false} />
              ))}
            </Animated.View>
          ) : empty ? (
            <>{empty}</>
          ) : null
        }
        renderItem={({ item }) => (
          <Row
            item={item}
            button={!item.isMe && (typeof withButtons === 'function' ? withButtons(item) : withButtons)}
            following={following[item.username]}
            onToggle={() => toggle(item)}
            onOpen={onOpen}
          />
        )}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 18.5, paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function Row({
  item,
  button,
  following,
  onToggle,
  onOpen,
}: {
  item: Connection;
  button: boolean;
  following: boolean;
  onToggle: () => void;
  onOpen?: (c: Connection) => void;
}) {
  // On the root copy of the lists (/u/...) profiles stay on the root stack too.
  const root = usePathname().startsWith('/u/');
  return (
    <View style={styles.row}>
      <PressableScale
        scaleTo={0.98}
        onPress={() => (onOpen ? onOpen(item) : openProfile(item.username, root))}
        style={styles.person}
        accessibilityRole="button"
        accessibilityLabel={item.username}>
        {item.avatar ? (
          <Image source={item.avatar} style={styles.avatar} transition={150} />
        ) : (
          <Icon name="avatarPlaceholder" width={53} style={styles.avatar} />
        )}
        <View style={styles.names}>
          <Text style={styles.name} numberOfLines={1}>
            {item.username}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
      </PressableScale>
      {button ? (
        <View style={styles.button}>
          <FollowButton following={following} onPress={onToggle} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: HEADER_H },
  back: { position: 'absolute', left: 19.45, top: 22.93 },
  title: { position: 'absolute', left: 58, top: 20.01, fontFamily: INTER_FAMILIES['700'], fontSize: 23, lineHeight: 28, color: colors.text },
  // x 10..380, 39 tall; magnifier at x 25.4, text at x 53.4
  field: {
    height: 39,
    marginLeft: 10,
    marginRight: 10,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15.4,
    gap: 13.6,
  },
  input: { flex: 1, fontFamily: INTER_FAMILIES['400'], fontSize: 14.8, color: colors.text, padding: 0, height: 39 },
  // rows 74 tall: avatar 53 at x 11 (10.5 down), names 10 under its top at x 77, button 105x28 at right 10
  row: { height: 74, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 10.5, paddingLeft: 11, paddingRight: 10 },
  person: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  avatar: { width: 53, height: 53, borderRadius: 26.5, backgroundColor: colors.surfaceSoft },
  names: { flex: 1, paddingTop: 10 },
  name: { fontFamily: INTER_FAMILIES['600'], fontSize: 13.9, lineHeight: 17, color: colors.text },
  sub: { marginTop: 1.06, fontFamily: INTER_FAMILIES['300'], fontSize: 13, lineHeight: 16, color: MUTED },
  button: { marginLeft: 8, marginTop: 12.875 },
});
