import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from '@/components/text';

type Props = {
  title: string;
  subtitle?: string;
  centered?: boolean;
  showBack?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
  avoidKeyboard?: boolean;
  /** Horizontal padding; signup frames use 13, interests uses 18. */
  gutter?: number;
  /** Extra distance of the footer above the safe-area bottom (design-specific). */
  footerLift?: number;
  /** Title top relative to the safe area when there is no back button. */
  titleTop?: number;
};

const KEYBOARD_GAP = 10;

export function StepScreen({
  title,
  subtitle,
  centered,
  showBack = true,
  children,
  footer,
  avoidKeyboard = true,
  gutter = 13,
  footerLift = 0,
  titleTop = 37,
}: Props) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 12) + footerLift;

  return (
    <View style={[styles.root, { paddingTop: insets.top + (showBack ? 18 : titleTop), paddingHorizontal: gutter }]}>
      {showBack ? (
        <View style={styles.backRow}>
          <PressableScale onPress={() => router.back()} hitSlop={14} accessibilityLabel="Back" style={styles.back}>
            <Icon name="back" width={19} height={17} />
          </PressableScale>
        </View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(380).withInitialValues({ transform: [{ translateY: 10 }] })}>
        <Text style={[styles.title, centered && styles.centerText]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, centered && styles.centerText]}>{subtitle}</Text> : null}
      </Animated.View>

      <View style={styles.body}>{children}</View>

      {footer ? (
        <KeyboardStickyView enabled={avoidKeyboard} offset={{ closed: 0, opened: bottomPad - KEYBOARD_GAP }}>
          <View style={[styles.footer, { paddingBottom: bottomPad }]}>{footer}</View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  backRow: { height: 28, justifyContent: 'center', marginBottom: 12 },
  back: { width: 32, height: 28, justifyContent: 'center' },
  title: { fontSize: 32, lineHeight: 36, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  subtitle: { marginTop: 10, fontSize: 16.5, lineHeight: 22, color: colors.textMuted, letterSpacing: -0.33 },
  centerText: { textAlign: 'center' },
  body: { flex: 1, marginTop: 26 },
  footer: { paddingTop: 12 },
});
