import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, layout, motion } from '@/theme';
import { PressableScale } from './pressable-scale';
import { AnimatedText } from '@/components/text';

type Props = {
  title: string;
  onPress: () => void;
  enabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline';
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ title, onPress, enabled = true, loading = false, variant = 'primary', style }: Props) {
  const active = useSharedValue(enabled ? 1 : 0);

  useEffect(() => {
    active.value = withTiming(enabled ? 1 : 0, { duration: motion.base });
  }, [enabled, active]);

  const outline = variant === 'outline';

  const bgStyle = useAnimatedStyle(() =>
    outline
      ? {}
      : { backgroundColor: interpolateColor(active.value, [0, 1], [colors.disabled, colors.primary]) },
  );
  const textStyle = useAnimatedStyle(() =>
    outline ? {} : { color: interpolateColor(active.value, [0, 1], [colors.textMuted, '#FFFFFF']) },
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
          <AnimatedText style={[styles.label, outline ? styles.outlineLabel : null, textStyle]}>{title}</AnimatedText>
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
  label: {
    fontSize: 17.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  outlineLabel: {
    color: colors.text,
  },
});
