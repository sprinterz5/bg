import { StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

import { PressableScale } from './pressable-scale';
import { INTER_FAMILIES } from './text';

// AutoLayouted-9 / -11: Follow — black, white Inter SemiBold 13; Following — white with a #D9D9D9 border, #999 text.
// 105x28, radius 7. The colours cross-fade when the state flips.
export function FollowButton({ following, onPress, width = 105 }: { following: boolean; onPress: () => void; width?: number }) {
  const on = useDerivedValue(() => withTiming(following ? 0 : 1, { duration: 180 }));
  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], ['#FFFFFF', '#000000']),
    borderColor: interpolateColor(on.get(), [0, 1], ['#D9D9D9', '#000000']),
  }));
  const text = useAnimatedStyle(() => ({ color: interpolateColor(on.get(), [0, 1], ['#999999', '#FFFFFF']) }));
  return (
    <PressableScale haptic onPress={onPress} scaleTo={0.94} accessibilityRole="button" accessibilityLabel={following ? 'Following' : 'Follow'}>
      <Animated.View collapsable={false} style={[styles.box, { width }, box]}>
        <Animated.Text style={[styles.text, text]}>{following ? 'Following' : 'Follow'}</Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  box: { height: 28, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: INTER_FAMILIES['600'], fontSize: 13, lineHeight: 16 },
});
