import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Icon } from './icon';

// A watched story's ring turning grey: the grey ring is revealed once round from the top, clockwise, over the
// gradient one. Plain views (no canvas: a freshly created Skia surface on Android can show a frame of stale GPU
// memory). Classic two-halves reveal: each half of the grey ring turns into its own half-clip, the right one first.
export function RingSweep({ size, delay, onDone }: { size: number; delay: number; onDone: () => void }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }, (fin) => {
        if (fin) runOnJS(onDone)();
      }),
    );
  }, [delay, p, onDone]);

  const half = size / 2;
  // Left half of the grey ring turning into the right clip: 0° hidden → 180° fills it (top → bottom).
  const right = useAnimatedStyle(() => ({ transform: [{ rotate: `${Math.min(1, p.value * 2) * 180}deg` }] }));
  // Then the right half turning into the left clip (bottom → top).
  const left = useAnimatedStyle(() => ({ transform: [{ rotate: `${Math.max(0, p.value * 2 - 1) * 180}deg` }] }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.clip, { left: half, width: half, height: size }]}>
        <Animated.View collapsable={false} style={[{ position: 'absolute', left: -half, width: size, height: size }, right]}>
          <View style={[styles.clip, { left: 0, width: half, height: size }]}>
            <Icon name="storyRingSeen" width={size} />
          </View>
        </Animated.View>
      </View>
      <View style={[styles.clip, { left: 0, width: half, height: size }]}>
        <Animated.View collapsable={false} style={[{ position: 'absolute', left: 0, width: size, height: size }, left]}>
          <View style={[styles.clip, { left: half, width: half, height: size }]}>
            <View style={{ position: 'absolute', left: -half }}>
              <Icon name="storyRingSeen" width={size} />
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { position: 'absolute', top: 0, overflow: 'hidden' },
});
