import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

type Props = {
  liked: boolean;
  onToggle: () => void;
  count: number;
  format?: (n: number) => string;
  icons: { off: IconName; on: IconName };
  width: number;
  height: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  countStyle?: StyleProp<TextStyle>;
};

const ROLL = 7;

// dir: 1 = counter goes up (like), -1 = down (unlike). Read inside the worklets at animation time,
// because an exiting view keeps the props of its last render.
const rollIn =
  (dir: SharedValue<number>): EntryExitAnimationFunction =>
  () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateY: ROLL * dir.value }] },
      animations: {
        opacity: withTiming(1, { duration: 180 }),
        transform: [{ translateY: withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }) }],
      },
    };
  };
const rollOut =
  (dir: SharedValue<number>): EntryExitAnimationFunction =>
  () => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
      animations: {
        opacity: withTiming(0, { duration: 140 }),
        transform: [{ translateY: withTiming(-ROLL * dir.value, { duration: 180, easing: Easing.in(Easing.cubic) }) }],
      },
    };
  };

/**
 * Like: the outline fades while the filled heart grows out of it with a soft overshoot; the counter rolls up.
 * Unlike: the filled heart shrinks away into the outline and the counter rolls down.
 */
export function LikeButton({ liked, onToggle, count, format = String, icons, width, height, gap = 6, style, countStyle }: Props) {
  const fill = useSharedValue(liked ? 1 : 0);
  const scale = useSharedValue(1);
  const dir = useSharedValue(1);
  const first = useRef(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (liked) {
      fill.value = withTiming(1, { duration: 120 });
      scale.value = withSequence(withTiming(0.55, { duration: 0 }), withSpring(1, { damping: 7, stiffness: 260, mass: 0.6 }));
    } else {
      fill.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.quad) });
      scale.value = withSequence(withTiming(0.8, { duration: 90 }), withSpring(1, { damping: 14, stiffness: 300 }));
    }
  }, [liked, fill, scale]);

  const outline = useAnimatedStyle(() => ({ opacity: 1 - fill.value }));
  const filled = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ scale: scale.value }] }));

  const press = () => {
    dir.value = liked ? -1 : 1;
    Haptics.impactAsync(liked ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    onToggle();
  };

  return (
    <PressableScale onPress={press} hitSlop={8} scaleTo={0.9} accessibilityRole="button" accessibilityLabel={liked ? 'Unlike' : 'Like'} style={[styles.row, { gap }, style]}>
      <View style={{ width, height }}>
        <Animated.View style={[StyleSheet.absoluteFill, outline]}>
          <Icon name={icons.off} width={width} height={height} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, filled]}>
          <Icon name={icons.on} width={width} height={height} />
        </Animated.View>
      </View>
      <View style={styles.countClip}>
        <Animated.View key={count} entering={mounted ? rollIn(dir) : undefined} exiting={rollOut(dir)}>
          <Text style={countStyle}>{format(count)}</Text>
        </Animated.View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  countClip: { overflow: 'hidden' },
});
