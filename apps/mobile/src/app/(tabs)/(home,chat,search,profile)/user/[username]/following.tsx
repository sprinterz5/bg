import { useLocalSearchParams, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ConnectionsScreen } from '@/components/connections-screen';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { INTER_FAMILIES, Text } from '@/components/text';
import { push } from '@/lib/nav';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function Following() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user } = useSession();
  const own = !!user && user.username === username;
  if (!own) return <ConnectionsScreen title="Following" withButtons={false} source={{ username: username ?? '', kind: 'following' }} />;
  // AutoLayouted-11 (own list): own username centred, a compose icon on the right (opens a new message — not
  // designed), Following buttons to unfollow; no back button (swipe / system back).
  return (
    <ConnectionsScreen
      title="Following"
      withButtons
      source={{ username: user.username, kind: 'following' }}
      header={
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {user.username}
          </Text>
          <PressableScale onPress={() => push('/conversation/new' as Href)} hitSlop={10} scaleTo={0.88} accessibilityLabel="New message" style={styles.compose}>
            <Icon name="followingCompose" width={24.25} height={24.25} />
          </PressableScale>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { height: 62, alignItems: 'center' },
  title: { marginTop: 12.45, maxWidth: 260, fontFamily: INTER_FAMILIES['700'], fontSize: 22.6, lineHeight: 27, color: colors.text },
  compose: { position: 'absolute', right: 12.88, top: 13.88 },
});
