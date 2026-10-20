import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, layout } from '@/theme';
import { PressableScale } from './pressable-scale';
import { AnimatedText } from '@/components/text';

// Signup frames (No layout, AutoLayouted-3): a disabled Continue is #B3B3B3 with white text.
const DISABLED = '#B3B3B3';

type Props = {
  title: string;
  onPress: () => void;
  enabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline';
  style?: StyleProp<ViewStyle>;
  /** Frames that set the label differently (e.g. "Upload from gallery"). */
  labelStyle?: StyleProp<TextStyle>;
};

export function PrimaryButton({ title, onPress, enabled = true, loading = false, variant = 'primary', style, labelStyle }: Props) {
  const active = useSharedValue(enabled ? 1 : 0);

  useEffect(() => {
    // quick: the button should be black as soon as the step is valid
    active.set(withTiming(enabled ? 1 : 0, { duration: 140 }));
  }, [enabled, active]);

  const outline = variant === 'outline';

  const bgStyle = useAnimatedStyle(() =>
    outline
      ? {}
      : { backgroundColor: interpolateColor(active.value, [0, 1], [DISABLED, colors.primary]) },
  );
  const textStyle = useAnimatedStyle(() =>
    outline ? {} : { color: '#FFFFFF' },
  );

  const interactive = enabled && !loading;

  return (
    <PressableScale
      haptic
      disabled={!interactive}
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityState={{ disabled: !interactive }}
      style={style}>
      <Animated.View collapsable={false} style={[styles.base, outline ? styles.outline : null, bgStyle]}>
        {loading ? (
          <ActivityIndicator color={outline ? colors.text : '#FFFFFF'} />
        ) : (
          <AnimatedText style={[styles.label, outline ? styles.outlineLabel : null, labelStyle, textStyle]}>{title}</AnimatedText>
        )}
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    height: layout.buttonHeight,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.disabled,
  },
  // Continue in the signup frames: Inter Bold ~17.5, tracked in a little.
  label: {
    fontSize: 17.5,
    fontWeight: '700',
    letterSpacing: -0.26,
  },
  outlineLabel: {
    color: colors.text,
  },
});
