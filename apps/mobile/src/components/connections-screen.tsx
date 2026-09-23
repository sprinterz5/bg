import { Image } from 'expo-image';
import { type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/text';
import { CONNECTIONS, type Connection } from '@/mock/data';
import { colors } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { ProfileButton } from './profile';
import { back, push } from '@/lib/nav';

// Figma 3184:982 (Followers, with Follow/Following buttons) and 3184:1274 (Following, no buttons).
const HEADER_H = 67; // back + title centred on design y 80.5, search field starts at y 114
const MUTED = '#737A84';

type Props = {
  title: string;
  /** Which rows get a Follow / Following button. */
  withButtons: boolean | ((c: Connection) => boolean);
  /** Replaces the default back + title header (e.g. the centred header of 3185:1524). */
  header?: ReactNode;
  /** Initial follow state per row; defaults to the mock data. */
  initialFollowing?: (c: Connection) => boolean;
};

export function ConnectionsScreen({ title, withButtons, header, initialFollowing }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [following, setFollowing] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CONNECTIONS.map((c) => [c.username, initialFollowing ? initialFollowing(c) : c.following])),
  );

  const q = query.trim().toLowerCase();
  const data = useMemo(() => (q ? CONNECTIONS.filter((c) => c.username.includes(q) || c.subtitle.includes(q)) : CONNECTIONS), [q]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header ?? (
        <View style={styles.header}>
          <PressableScale onPress={() => back()} hitSlop={12} scaleTo={0.85} accessibilityLabel="Back" style={styles.back}>
            <Icon name="searchBack" width={12} height={20} />
          </PressableScale>
          <Text style={styles.title}>{title}</Text>
        </View>
      )}

      <View style={styles.field}>
        <Icon name="searchField" width={15} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor="#536471"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          selectionColor={colors.primary}
          cursorColor={colors.text}
          style={styles.input}
          accessibilityLabel={`Search ${title.toLowerCase()}`}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(c) => c.username}
        renderItem={({ item }) => (
          <Row
            item={item}
            button={typeof withButtons === 'function' ? withButtons(item) : withButtons}
            following={following[item.username]}
            onToggle={() => setFollowing((f) => ({ ...f, [item.username]: !f[item.username] }))}
          />
        )}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 19, paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function Row({ item, button, following, onToggle }: { item: Connection; button: boolean; following: boolean; onToggle: () => void }) {
  return (
    <View style={styles.row}>
      <PressableScale
        scaleTo={0.98}
        onPress={() => push(`/user/${encodeURIComponent(item.username)}` as Href)}
        style={styles.person}
        accessibilityRole="button"
        accessibilityLabel={item.username}>
        <Image source={item.avatar} style={styles.avatar} transition={150} />
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
          <ProfileButton label={following ? 'Following' : 'Follow'} primary={!following} height={29} fill={false} onPress={onToggle} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: HEADER_H, flexDirection: 'row', alignItems: 'center', paddingLeft: 19 },
  back: { width: 12, height: 20 },
  title: { marginLeft: 28, fontSize: 21, lineHeight: 26, fontWeight: '700', color: colors.text },
  // x 10..379, 39 tall; magnifier at x 25, text at x 54
  field: {
    height: 39,
    marginLeft: 10,
    marginRight: 11,
    borderRadius: 10,
    backgroundColor: '#EFF3F4',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    gap: 14,
  },
  input: { flex: 1, fontSize: 16, color: colors.text, padding: 0, height: 39 },
  // rows 72 tall: avatar 53 at x 11, names at x 77, button 105x29 at right 11
  row: { height: 72, flexDirection: 'row', alignItems: 'center', paddingLeft: 11, paddingRight: 11 },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: { width: 53, height: 53, borderRadius: 26.5, backgroundColor: colors.surfaceSoft },
  names: { flex: 1 },
  name: { fontSize: 14, lineHeight: 17, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, lineHeight: 16, color: MUTED },
  button: { width: 105, marginLeft: 8 },
});
