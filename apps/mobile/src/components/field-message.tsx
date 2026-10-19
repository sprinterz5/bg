import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { colors } from '@/theme';
import { Icon } from './icon';
import { Text, INTER_FAMILIES } from '@/components/text';

type Props = { text: string; tone?: 'hint' | 'error' };

export function FieldMessage({ text, tone = 'hint' }: Props) {
  return (
    <Animated.View collapsable={false} key={`${tone}:${text}`} entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={[styles.row, tone === 'error' && styles.rowError]}>
      {/* No Layout-1: the red ✕ sits in the first line, the second line runs under it (en spaces make room) */}
      {tone === 'error' ? (
        <View style={styles.icon}>
          <Icon name="errorX" width={15} />
        </View>
      ) : null}
      <Text style={styles.text}>{tone === 'error' ? `\u2002\u2002 ${text}` : text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // the password hint wraps after "with", the username error after "change"
  row: { marginTop: 14, paddingRight: 44 },
  rowError: { paddingRight: 24 },
  icon: { position: 'absolute', left: 0, top: 3.6 },
  // AutoLayouted-2 / -3 / No Layout-1: hints and errors alike Inter 16.25 #8C8C8C, lines ~22.4 apart.
  text: { flex: 1, fontFamily: INTER_FAMILIES['400'], fontSize: 16.25, lineHeight: 22.4, color: colors.textMuted },
});
