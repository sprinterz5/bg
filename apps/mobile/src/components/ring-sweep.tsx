import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

// Grey ring of a watched story, drawn as a bordered circle (Frame 1198: 98.2 wide, stroke 3.6 #DBE0E6 inside
// the edge). Not the SVG: as an image inside the half-clips below it rasterized at a different
// size on Android, so the sweeping band didn't match the ring.
const SEEN_STROKE = 3.6;
const SEEN_BASE = 98.2;
const SEEN_COLOR = '#DBE0E6';

export function SeenRing({ size }: { size: number }) {
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size / 2, borderWidth: (SEEN_STROKE * size) / SEEN_BASE, borderColor: SEEN_COLOR }} />;
}

// A watched story's ring turning grey, like a loading spinner finishing: a grey line with round ends runs
// clockwise from the top, the whole line turning while it grows until it closes into the full ring.
// Plain views (no canvas: a freshly created Skia surface on Android can show a frame of stale GPU memory).
// The line is a two-halves reveal (each half of the grey ring turns into its own half-clip, the right one
// first) inside a rotating box; two dots of the stroke width round off its ends.
const SWEEP_MS = 600;
const SWEEP_TURN = 120; // degrees the line's tail travels while its length goes 0 → 360

function easeInOut(x: number) {
  'worklet';
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

function easeOut(x: number) {
  'worklet';
  return 1 - (1 - x) ** 3;
}

export function RingSweep({ size, delay, onDone }: { size: number; delay: number; onDone: () => void }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(
      delay,
      withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }, (fin) => {
        if (fin) runOnJS(onDone)();
      }),
    ));
  }, [delay, p, onDone]);

  const half = size / 2;
  const stroke = (SEEN_STROKE * size) / SEEN_BASE;
  const mid = half - stroke / 2; // radius of the stroke's centre line

  // Line length in degrees.
  const length = useDerivedValue(() => 360 * easeInOut(p.value));
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${SWEEP_TURN * easeOut(p.value)}deg` }] }));
  // Left half of the grey ring turning into the right clip: 0° hidden → 180° fills it (top → bottom).
  const right = useAnimatedStyle(() => ({ transform: [{ rotate: `${Math.min(180, length.value)}deg` }] }));
  // Then the right half turning into the left clip (bottom → top).
  const left = useAnimatedStyle(() => ({ transform: [{ rotate: `${Math.max(0, length.value - 180)}deg` }] }));
  const head = useAnimatedStyle(() => {
    const a = (length.value * Math.PI) / 180;
    return {
      opacity: p.value > 0 ? 1 : 0,
      transform: [{ translateX: half + mid * Math.sin(a) - stroke / 2 }, { translateY: half - mid * Math.cos(a) - stroke / 2 }],
    };
  });
  const tail = useAnimatedStyle(() => ({ opacity: p.value > 0 ? 1 : 0 }));
  const dot = { position: 'absolute' as const, left: 0, top: 0, width: stroke, height: stroke, borderRadius: stroke / 2, backgroundColor: SEEN_COLOR };

  return (
    <Animated.View collapsable={false} pointerEvents="none" style={[StyleSheet.absoluteFill, turn]}>
      <View style={[styles.clip, { left: half, width: half, height: size }]}>
        <Animated.View collapsable={false} style={[{ position: 'absolute', left: -half, width: size, height: size }, right]}>
          <View style={[styles.clip, { left: 0, width: half, height: size }]}>
            <SeenRing size={size} />
          </View>
        </Animated.View>
      </View>
      <View style={[styles.clip, { left: 0, width: half, height: size }]}>
        <Animated.View collapsable={false} style={[{ position: 'absolute', left: 0, width: size, height: size }, left]}>
          <View style={[styles.clip, { left: half, width: half, height: size }]}>
            <View style={{ position: 'absolute', left: -half, width: size, height: size }}>
              <SeenRing size={size} />
            </View>
          </View>
        </Animated.View>
      </View>
      <Animated.View style={[dot, { transform: [{ translateX: half - stroke / 2 }] }, tail]} />
      <Animated.View style={[dot, head]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { position: 'absolute', top: 0, overflow: 'hidden' },
});
