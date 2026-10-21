import { Image } from 'expo-image';
import { useEffect, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export type Crop = { originX: number; originY: number; width: number; height: number };

type Props = {
  uri: string;
  /** The photo's size in pixels. */
  imageW: number;
  imageH: number;
  /** The viewport; the crop window (aspect w/h) is the largest one that fits in its middle. */
  boxW: number;
  boxH: number;
  aspect: number;
  /** Filled with a reader of the current crop in image pixels. */
  cropRef: RefObject<(() => Crop) | null>;
};

const MAX_ZOOM = 5;

// Not designed: Instagram-like cropping. The photo covers the window and can be dragged and pinched; a 3×3 grid
// shows while a finger is down; outside the window it's dimmed.
export function CropView({ uri, imageW, imageH, boxW, boxH, aspect, cropRef }: Props) {
  let cw = boxW;
  let ch = boxW / aspect;
  if (ch > boxH) {
    ch = boxH;
    cw = boxH * aspect;
  }
  const base = Math.max(cw / imageW, ch / imageH);
  const zoom = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ zoom: 1, x: 0, y: 0 });
  const touching = useSharedValue(0);

  useEffect(() => {
    zoom.set(1);
    tx.set(0);
    ty.set(0);
  }, [uri, zoom, tx, ty]);

  useEffect(() => {
    cropRef.current = () => {
      const s = base * zoom.get();
      const width = Math.min(imageW, cw / s);
      const height = Math.min(imageH, ch / s);
      const originX = Math.max(0, Math.min(imageW - width, imageW / 2 - tx.get() / s - width / 2));
      const originY = Math.max(0, Math.min(imageH - height, imageH / 2 - ty.get() / s - height / 2));
      return { originX: Math.round(originX), originY: Math.round(originY), width: Math.round(width), height: Math.round(height) };
    };
  }, [cropRef, base, cw, ch, imageW, imageH, zoom, tx, ty]);

  const clampX = (x: number, z: number) => {
    'worklet';
    const m = Math.max(0, (imageW * base * z - cw) / 2);
    return Math.min(m, Math.max(-m, x));
  };
  const clampY = (y: number, z: number) => {
    'worklet';
    const m = Math.max(0, (imageH * base * z - ch) / 2);
    return Math.min(m, Math.max(-m, y));
  };

  const begin = () => {
    'worklet';
    start.set({ zoom: zoom.get(), x: tx.get(), y: ty.get() });
    touching.set(withTiming(1, { duration: 150 }));
  };
  const settle = () => {
    'worklet';
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom.get()));
    zoom.set(withTiming(z, { duration: 200 }));
    tx.set(withTiming(clampX(tx.get(), z), { duration: 200 }));
    ty.set(withTiming(clampY(ty.get(), z), { duration: 200 }));
    touching.set(withTiming(0, { duration: 250 }));
  };

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(begin)
    .onUpdate((e) => {
      // rubber band past the edges, snapped back on release
      const z = zoom.get();
      const x = start.get().x + e.translationX;
      const y = start.get().y + e.translationY;
      const cx = clampX(x, z);
      const cy = clampY(y, z);
      tx.set(cx + (x - cx) / 3);
      ty.set(cy + (y - cy) / 3);
    })
    .onEnd(settle);
  const pinch = Gesture.Pinch()
    .onStart(begin)
    .onUpdate((e) => {
      const z0 = start.get().zoom;
      const z = Math.min(MAX_ZOOM * 1.2, Math.max(0.8, z0 * e.scale));
      // keeps the point in the window's middle in place
      tx.set((start.get().x * z) / z0);
      ty.set((start.get().y * z) / z0);
      zoom.set(z);
    })
    .onEnd(settle);

  const photo = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: zoom.get() }],
  }));
  const grid = useAnimatedStyle(() => ({ opacity: touching.get() }));

  const left = (boxW - cw) / 2;
  const top = (boxH - ch) / 2;
  const w = imageW * base;
  const h = imageH * base;

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
      <View style={{ width: boxW, height: boxH, overflow: 'hidden' }} collapsable={false}>
        <Animated.View style={[{ position: 'absolute', width: w, height: h, left: (boxW - w) / 2, top: (boxH - h) / 2 }, photo]}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="fill" transition={150} />
        </Animated.View>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.dim, { left: 0, right: 0, top: 0, height: top }]} />
          <View style={[styles.dim, { left: 0, right: 0, bottom: 0, height: top }]} />
          <View style={[styles.dim, { left: 0, width: left, top, height: ch }]} />
          <View style={[styles.dim, { right: 0, width: left, top, height: ch }]} />
          <Animated.View style={[{ position: 'absolute', left, top, width: cw, height: ch }, styles.frame, grid]}>
            <View style={[styles.line, styles.v, { left: cw / 3 }]} />
            <View style={[styles.line, styles.v, { left: (cw * 2) / 3 }]} />
            <View style={[styles.line, styles.h, { top: ch / 3 }]} />
            <View style={[styles.line, styles.h, { top: (ch * 2) / 3 }]} />
          </Animated.View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  frame: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.8)' },
  line: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.6)' },
  v: { top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  h: { left: 0, right: 0, height: StyleSheet.hairlineWidth },
});
