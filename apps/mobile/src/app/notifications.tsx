import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { INTER_FAMILIES, Text } from '@/components/text';
import { back, openProfile } from '@/lib/nav';
import { NOTIFICATIONS, type Notice } from '@/mock/data';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// AutoLayouted-37. Title = own username; rows step 73 (avatar 53 + 20); section titles 37 above the first row.
// Header stays put, the sections scroll under it.
const MUTED = '#999999';

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [following, setFollowing] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATIONS.flatMap((s) => s.items).map((n) => [n.id, !!n.follow])),
  );

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
        {NOTIFICATIONS.map((section, i) => (
          <View key={section.title} style={i > 0 && styles.sectionGap}>
            <Text style={styles.section}>{section.title}</Text>
            {section.items.map((n) => (
              <Row
                key={n.id}
                item={n}
                muted={section.muted}
                following={following[n.id]}
                onToggle={() => setFollowing((f) => ({ ...f, [n.id]: !f[n.id] }))}
              />
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
    <View style={styles.row}>
      <PressableScale
        scaleTo={0.98}
        onPress={() => openProfile(item.username, true)}
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
          <Text style={styles.who} numberOfLines={1}>
            {item.who}
          </Text>
          <Text style={[styles.what, muted && { color: MUTED }]} numberOfLines={1}>
            {item.what}
          </Text>
        </View>
      </PressableScale>
      {item.thumb ? (
        <Image source={item.thumb} style={styles.thumb} transition={150} />
      ) : item.follow !== undefined ? (
        <PressableScale haptic onPress={onToggle} scaleTo={0.94} style={[styles.button, following ? styles.buttonOff : styles.buttonOn]}>
          <Text style={[styles.buttonText, following && styles.buttonTextOff]}>{following ? 'Following' : 'Follow'}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: 61 },
  back: { position: 'absolute', left: 18.97, top: 21.81 },
  title: { position: 'absolute', left: 51, right: 16, top: 19.97, fontFamily: INTER_FAMILIES['700'], fontSize: 22, lineHeight: 27, color: colors.text },
  sectionGap: { marginTop: 25.8 },
  section: { marginLeft: 11, marginBottom: 21.18, fontFamily: INTER_FAMILIES['600'], fontSize: 16.5, lineHeight: 20, color: colors.text },
  row: { height: 53, marginBottom: 20, flexDirection: 'row', alignItems: 'center', paddingLeft: 11, paddingRight: 12 },
  person: { flex: 1, flexDirection: 'row', alignSelf: 'stretch' },
  avatar: { width: 53, height: 53, borderRadius: 26.5 },
  // Grouped actors: two 38px circles, the second 15 right / 14 down over the first.
  pair: { position: 'absolute', left: 0, top: 0, width: 38, height: 38, borderRadius: 19 },
  pairBack: { left: 15, top: 14 },
  texts: { flex: 1, marginLeft: 13, paddingTop: 10.8 },
  who: { fontFamily: INTER_FAMILIES['600'], fontSize: 14, lineHeight: 17, color: colors.text },
  what: { marginTop: 0.3, fontFamily: INTER_FAMILIES['400'], fontSize: 12.7, lineHeight: 15, color: colors.text },
  thumb: { width: 74, height: 45, borderRadius: 5, marginLeft: 12 },
  button: { width: 103, height: 28, borderRadius: 7, marginLeft: 12, marginTop: 3, alignItems: 'center', justifyContent: 'center' },
  buttonOn: { backgroundColor: '#000000' },
  buttonOff: { borderWidth: 1, borderColor: '#D9D9D9' },
  buttonText: { fontFamily: INTER_FAMILIES['600'], fontSize: 13.5, lineHeight: 16, color: '#FFFFFF' },
  buttonTextOff: { fontFamily: INTER_FAMILIES['500'], color: MUTED },
});
