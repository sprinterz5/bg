import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedReaction, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

import { colors } from '@/theme';

// Instagram-style refresh spinner: 12 spokes that appear one by one while pulling (all of them at
// `threshold`), then tick round with a fading tail while refreshing. Centred in the `pull`-tall gap.
const SPOKES = 12;
const SIZE = 28;

export function PullSpinner({ pull, threshold, refreshing, top }: { pull: SharedValue<number>; threshold: number; refreshing: boolean; top: number }) {
  const spin = useSharedValue(0);
  const active = useSharedValue(0);
  // Spokes shown while pulling and the gap height. Only written when they change, so a normal scroll
  // (pull stays 0) never touches the spinner's views.
  const shown = useSharedValue(0);
  const gap = useSharedValue(0);
  useAnimatedReaction(
    () => Math.max(0, pull.value),
    (p) => {
      const n = Math.min(SPOKES, Math.ceil((p / threshold) * SPOKES));
      if (n !== shown.value) shown.value = n;
      if (p !== gap.value && (p > 0 || gap.value > 0)) gap.value = p;
    },
  );

  useEffect(() => {
    active.value = refreshing ? 1 : 0;
    if (refreshing) {
      spin.value = 0;
      spin.value = withRepeat(withTiming(SPOKES, { duration: 1000, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(spin);
    }
  }, [refreshing, spin, active]);

  const boxStyle = useAnimatedStyle(() => ({
    opacity: gap.value > 2 ? 1 : 0,
    transform: [{ translateY: Math.max(gap.value, SIZE) / 2 - SIZE / 2 }],
  }));

  return (
    <Animated.View collapsable={false} pointerEvents="none" style={[styles.box, { top }, boxStyle]}>
      {Array.from({ length: SPOKES }, (_, i) => (
        <Spoke key={i} index={i} shown={shown} spin={spin} active={active} />
      ))}
    </Animated.View>
  );
}

function Spoke({ index, shown, spin, active }: { index: number; shown: SharedValue<number>; spin: SharedValue<number>; active: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    if (active.value) {
      // Head spoke is solid, the ones behind it fade out.
      const behind = (Math.floor(spin.value) - index + SPOKES) % SPOKES;
      return { opacity: 1 - (behind / SPOKES) * 0.8 };
    }
    return { opacity: shown.value > index ? 0.85 : 0 };
  });
  return (
    <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${index * (360 / SPOKES)}deg` }] }]}>
      <Animated.View collapsable={false} style={[styles.spoke, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', alignSelf: 'center', width: SIZE, height: SIZE },
  spoke: { position: 'absolute', left: SIZE / 2 - 1.25, top: 0, width: 2.5, height: 8, borderRadius: 1.25, backgroundColor: colors.textMuted },
});
