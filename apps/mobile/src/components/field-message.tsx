import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { colors } from '@/theme';
import { Icon } from './icon';
import { Text, INTER_FAMILIES } from '@/components/text';

type Props = { text: string; tone?: 'hint' | 'error' };

export function FieldMessage({ text, tone = 'hint' }: Props) {
  return (
    <Animated.View collapsable={false} key={`${tone}:${text}`} entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={styles.row}>
      {/* No Layout-1: the red ✕ sits inline, the second line runs under it */}
      <Text style={styles.text}>
        {tone === 'error' ? (
          <View style={styles.icon}>
            <Icon name="errorX" width={15} />
          </View>
        ) : null}
        {tone === 'error' ? ' ' : ''}
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 14, gap: 6, paddingRight: 44 },
  icon: { width: 15, height: 15, transform: [{ translateY: 2.5 }] },
  // AutoLayouted-2 / -3 / No Layout-1: hints and errors alike Inter 16.25 #8C8C8C, lines ~22.4 apart.
  text: { flex: 1, fontFamily: INTER_FAMILIES['400'], fontSize: 16.25, lineHeight: 22.4, color: colors.textMuted },
});
