import { useEffect, useRef, type ReactNode } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

/**
 * Wraps an icon that toggles (like, bookmark): turning on pops it (overshoot and settle), turning off gives a small
 * shrink. Nothing moves on the first render.
 */
export function PopIcon({ active, children }: { active: boolean; children: ReactNode }) {
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scale.set(
      active
        ? withSequence(withTiming(1.28, { duration: 110 }), withSpring(1, { damping: 9, stiffness: 260 }))
        : withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 14, stiffness: 300 })),
    );
  }, [active, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
