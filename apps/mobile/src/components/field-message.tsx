import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { colors } from '@/theme';
import { Icon } from './icon';
import { Text } from '@/components/text';

type Props = { text: string; tone?: 'hint' | 'error' };

export function FieldMessage({ text, tone = 'hint' }: Props) {
  return (
    <Animated.View collapsable={false} key={`${tone}:${text}`} entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={styles.row}>
      {tone === 'error' ? (
        <View style={styles.icon}>
          <Icon name="errorX" width={15} />
        </View>
      ) : null}
      <Text style={[styles.text, tone === 'hint' && styles.hint]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 14, gap: 6, paddingRight: 24 },
  icon: { paddingTop: 3 },
  text: { flex: 1, fontSize: 18, lineHeight: 22, color: colors.textMuted, letterSpacing: -0.36 },
  hint: { fontSize: 13, lineHeight: 17, letterSpacing: 0 },
});
