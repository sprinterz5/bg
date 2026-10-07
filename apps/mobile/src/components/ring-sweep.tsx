import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Easing, runOnJS, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

// A watched story's ring turning grey: a grey stroke runs once round the gradient ring from the top, clockwise.
// Same circle as story-ring(-seen).svg (r 47.125 in a 97.5 box), a hair wider so no colour shows at the edges.
export function RingSweep({ size, color, delay, onDone }: { size: number; color: string; delay: number; onDone: () => void }) {
  const end = useSharedValue(0);
  useEffect(() => {
    end.value = withDelay(
      delay,
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic) }, (fin) => {
        if (fin) runOnJS(onDone)();
      }),
    );
  }, [delay, end, onDone]);

  const path = useMemo(() => {
    const k = size / 97.5;
    const r = 47.125 * k;
    const c = size / 2;
    const p = Skia.Path.Make();
    p.addArc({ x: c - r, y: c - r, width: r * 2, height: r * 2 }, -90, 359.9);
    return p;
  }, [size]);

  return (
    <View pointerEvents="none" collapsable={false} style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={path} style="stroke" strokeWidth={(3.25 * size) / 97.5 + 0.6} color={color} start={0} end={end} />
      </Canvas>
    </View>
  );
}
