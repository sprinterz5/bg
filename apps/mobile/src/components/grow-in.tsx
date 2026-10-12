import { useEffect, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

/**
 * Opens room for its content smoothly: the box grows from 0 to the content's height (content keeps its own size,
 * so pictures never re-decode) while the content fades and slides in. Used for posts arriving at the top of a list,
 * so the posts below glide down instead of jumping. List cells keep plain views (no layout animations, which crashed
 * on Android); only this box's height changes.
 */
export function GrowIn({ children, duration = 420 }: { children: ReactNode; duration?: number }) {
  const [h, setH] = useState<number | null>(null);
  const p = useSharedValue(0);
  const onLayout = (e: LayoutChangeEvent) => {
    if (h !== null) return;
    setH(e.nativeEvent.layout.height);
    p.set(withTiming(1, { duration, easing: EASE }));
  };
  const box = useAnimatedStyle(() => ({ height: (h ?? 0) * p.get() }));
  const content = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ translateY: (p.get() - 1) * 16 }] }));
  return (
    <Animated.View collapsable={false} style={[{ overflow: 'hidden' }, box]}>
      <Animated.View collapsable={false} style={content}>
        <View collapsable={false} onLayout={onLayout}>
          {children}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** The reverse for something leaving: once `closed`, the box shrinks from its height to 0 while the content fades. */
export function Collapse({ children, closed, duration = 420 }: { children: ReactNode; closed: boolean; duration?: number }) {
  const [h, setH] = useState<number | null>(null);
  const p = useSharedValue(1);
  useEffect(() => {
    p.set(withTiming(closed ? 0 : 1, { duration, easing: EASE }));
  }, [closed, duration, p]);
  const box = useAnimatedStyle(() => (h === null ? {} : { height: h * p.get() }));
  const content = useAnimatedStyle(() => ({ opacity: p.get() }));
  return (
    <Animated.View collapsable={false} style={[{ overflow: 'hidden' }, box]}>
      <Animated.View collapsable={false} style={content} onLayout={(e) => h === null && setH(e.nativeEvent.layout.height)}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}
