import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Author } from '@/mock/data';
import { colors, fonts } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from '@/components/text';

export function AuthorAvatar({ author, size = 32 }: { author: Author; size?: number }) {
  if (author.avatar) {
    return <Image source={author.avatar} style={{ width: size, height: size, borderRadius: size / 2 }} transition={150} />;
  }
  return (
    <View style={[styles.brandAvatar, { width: size, height: size }]}>
      <Icon name="bookgramAvatar" width={size} style={StyleSheet.absoluteFill} />
      <Text style={[styles.brandLetter, { fontSize: size * 0.72, lineHeight: size }]}>b</Text>
    </View>
  );
}

type Props = { author: Author; showMenu?: boolean; onMenu?: () => void };

export function AuthorRow({ author, showMenu = false, onMenu }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <AuthorAvatar author={author} />
        <View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{author.username}</Text>
            {author.verified ? <Icon name="verified" width={15} /> : null}
          </View>
          <Text style={styles.subtitle}>{author.subtitle}</Text>
        </View>
      </View>
      {showMenu ? (
        <PressableScale onPress={onMenu} hitSlop={12} accessibilityLabel="More" style={styles.menu}>
          <Icon name="dot" width={4} />
          <Icon name="dot" width={4} />
          <Icon name="dot" width={4} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 13, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12.5, color: colors.text, marginTop: 1 },
  menu: { flexDirection: 'row', gap: 3, paddingVertical: 8, paddingLeft: 8 },
  brandAvatar: { alignItems: 'center', justifyContent: 'center' },
  brandLetter: { color: '#FFFFFF', fontWeight: '900', fontFamily: fonts.serif, includeFontPadding: false },
});
