import { useEffect, useState, type ComponentProps } from 'react';
import Animated, { Easing, withTiming, type EntryExitAnimationFunction } from 'react-native-reanimated';

import { AnimatedText } from '@/components/text';

// A button label that rolls when it changes (Follow → Following): the old word slides up and fades, the new one
// rises in from below. The parent should clip (overflow hidden).
const ROLL = 8;

const rollIn: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: ROLL }] },
    animations: {
      opacity: withTiming(1, { duration: 200 }),
      transform: [{ translateY: withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) }) }],
    },
  };
};
const rollOut: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: 140 }),
      transform: [{ translateY: withTiming(-ROLL, { duration: 180, easing: Easing.in(Easing.cubic) }) }],
    },
  };
};

export function RollingLabel({ text, style }: { text: string; style?: ComponentProps<typeof AnimatedText>['style'] }) {
  // No roll on the first render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Animated.View collapsable={false} key={text} entering={mounted ? rollIn : undefined} exiting={rollOut}>
      <AnimatedText style={style}>{text}</AnimatedText>
    </Animated.View>
  );
}
