import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from '@/components/text';
import { back } from '@/lib/nav';

type Props = { title: string; note?: string; showBack?: boolean };

export function PlaceholderScreen({ title, note = 'Coming soon', showBack = false }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      {showBack ? (
        <PressableScale onPress={() => back()} hitSlop={14} accessibilityLabel="Back" style={styles.back}>
          <Icon name="back" width={19} height={17} />
        </PressableScale>
      ) : null}
      <Animated.View entering={FadeIn.duration(300)} style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.note}>{note}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 18 },
  back: { width: 32, height: 28, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  note: { fontSize: 15, color: colors.textMuted },
});
