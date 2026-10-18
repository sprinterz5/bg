import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { INTER_FAMILIES, Text } from '@/components/text';
import { back } from '@/lib/nav';

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
  /** Extra space above the title (the avatar step sits lower in the design). */
  titleShift?: number;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
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
  titleShift = 0,
  titleStyle,
  subtitleStyle,
}: Props) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 12) + footerLift;

  return (
    <View style={[styles.root, { paddingTop: insets.top + (showBack ? 11.5 : titleTop), paddingHorizontal: gutter }]}>
      {showBack ? (
        <View style={styles.backRow}>
          <PressableScale onPress={() => back()} hitSlop={14} accessibilityLabel="Back" style={styles.back}>
            <Icon name="back" width={19} height={17} />
          </PressableScale>
        </View>
      ) : null}

      <Animated.View collapsable={false} style={titleShift ? { marginTop: titleShift } : undefined} entering={FadeInDown.duration(380).withInitialValues({ transform: [{ translateY: 10 }] })}>
        <Text style={[styles.title, centered && styles.centerText, titleStyle]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, centered && styles.centerText, subtitleStyle]}>{subtitle}</Text> : null}
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

// AutoLayouted / -1 / -2 / -3 (white): back arrow 19x17 at (14, 17 under the status bar), the title's cap top at
// ~56, the field's line centred ~142 (cursor 127–157), Continue 10 above the keyboard.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  backRow: { height: 28, justifyContent: 'center', marginBottom: 10.3 },
  back: { width: 32, height: 28, justifyContent: 'center', marginLeft: 1 },
  // Inter on both platforms (the frames' glyph widths are Inter's).
  title: { fontSize: 32, lineHeight: 36, letterSpacing: -0.32, fontFamily: INTER_FAMILIES['800'], color: colors.text },
  subtitle: { marginTop: 10, fontSize: 16.5, lineHeight: 22, fontFamily: INTER_FAMILIES['400'], color: colors.textMuted },
  centerText: { textAlign: 'center' },
  body: { flex: 1, marginTop: 35.5 },
  footer: { paddingTop: 12 },
});
