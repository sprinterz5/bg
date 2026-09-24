import { StyleSheet, View } from 'react-native';

import { ConnectionsScreen } from '@/components/connections-screen';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { CONNECTIONS } from '@/mock/data';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// Figma 3185:1524 — own username centred with a compose button, search, people list;
// only the first two rows carry a "Following" button in the design.
const WITH_BUTTON = new Set(CONNECTIONS.slice(0, 2).map((c) => c.username));

export default function Chat() {
  const { user } = useSession();

  const header = (
    <View style={styles.header}>
      <Text style={styles.title} numberOfLines={1}>
        {user?.username ?? ''}
      </Text>
      <PressableScale hitSlop={10} scaleTo={0.88} accessibilityLabel="New message" style={styles.compose}>
        <Icon name="compose" width={24.25} />
      </PressableScale>
    </View>
  );

  return (
    <ConnectionsScreen
      title="Messages"
      header={header}
      withButtons={(c) => WITH_BUTTON.has(c.username)}
      initialFollowing={(c) => WITH_BUTTON.has(c.username)}
    />
  );
}

const styles = StyleSheet.create({
  // title centred 2.65px left of the screen centre, compose (24.25 with stroke) at x 351.9 / y 60.9; search field starts at y 109
  header: { height: 62, paddingBottom: 6, alignItems: 'center', justifyContent: 'center' },
  title: { maxWidth: 240, fontSize: 21, lineHeight: 26, fontWeight: '700', color: colors.text, transform: [{ translateX: -2.65 }] },
  compose: { position: 'absolute', right: 13.875, top: 13.875 },
});
