import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeOutDown, SlideInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { PUBLISH_MS } from '@/state/feed';
import { INTER_FAMILIES, Text } from '@/components/text';

// AutoLayouted-40 (TH(2)): a card floating 8 above the tab bar — 372×51 (r 13) #C9C8CC at x 9 with a soft shadow
// (y 1, blur 2, 25%); "Posting..." Inter 14.4 white, ink from (28.3, 725.6); on the right the cover 48×34 (r 5, white
// 1 outline) at half opacity, filled in from the bottom as it uploads (16 of 34 in the frame).
export function PostingRow({ coverUri, bottom }: { coverUri: string; bottom: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(1, { duration: PUBLISH_MS - 200, easing: Easing.out(Easing.cubic) }));
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({ height: `${progress.get() * 100}%` }));

  return (
    <Animated.View collapsable={false} entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))} exiting={FadeOutDown.duration(250)} style={[styles.card, { bottom }]}>
      <Text style={styles.label}>Posting...</Text>
      <View style={styles.thumb}>
        <Image source={{ uri: coverUri }} style={[StyleSheet.absoluteFill, styles.faded]} contentFit="cover" />
        <Animated.View collapsable={false} style={[styles.fill, fillStyle]}>
          <Image source={{ uri: coverUri }} style={styles.fillImage} contentFit="cover" />
        </Animated.View>
        <View style={styles.outline} pointerEvents="none" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 9,
    right: 9,
    height: 51,
    borderRadius: 13,
    backgroundColor: '#C9C8CC',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  // ink 19.6 into the card, 3 into a 17.3 line box
  label: { position: 'absolute', left: 18.2, top: 16.6, fontFamily: INTER_FAMILIES['400'], fontSize: 14.4, lineHeight: 17.3, color: '#FFFFFF' },
  thumb: { position: 'absolute', left: 311, top: 9, width: 48, height: 34, borderRadius: 5, overflow: 'hidden' },
  faded: { opacity: 0.5 },
  // the uploaded part: the same picture, full strength, from the bottom up
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  fillImage: { position: 'absolute', left: 0, bottom: 0, width: 48, height: 34 },
  outline: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 5, borderWidth: 1, borderColor: '#FFFFFF' },
});
