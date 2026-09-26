import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { PUBLISH_MS } from '@/state/feed';
import { colors } from '@/theme';
import { Text } from '@/components/text';

// Figma 3129:743: thumb 42x34 at x 9, label at x 63, track x 63..359, fill #455DFF on #B3B3B3.
export function PostingRow({ coverUri }: { coverUri: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: PUBLISH_MS - 200, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Animated.View collapsable={false} entering={FadeIn.duration(250)} exiting={FadeOut.duration(250)} style={styles.row}>
      <Image source={{ uri: coverUri }} style={styles.thumb} contentFit="cover" />
      <View style={styles.right}>
        <Text style={styles.label}>Posting...</Text>
        <View style={styles.track}>
          <Animated.View collapsable={false} style={[styles.fill, fillStyle]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 9, paddingRight: 31, gap: 12, marginTop: 26 },
  thumb: { width: 42, height: 34, borderRadius: 4, backgroundColor: colors.surfaceSoft },
  right: { flex: 1, gap: 7 },
  label: { fontSize: 12, lineHeight: 14, color: colors.textMuted },
  track: { height: 3, borderRadius: 2, backgroundColor: '#B3B3B3', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },
});
