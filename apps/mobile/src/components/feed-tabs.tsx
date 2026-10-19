import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { INTER_FAMILIES, Text } from '@/components/text';

const TABS = ['For you', 'Following', 'Learn', 'Grow'] as const;
export type FeedTab = (typeof TABS)[number];

// AutoLayouted-34 (BG(2)): labels Inter Medium 14.1 (active black, others #999) starting at x 18.7 / 114.3 / 231.5 /
// 326.9, cap tops 239.6; under the active one a 59×2 #2A2121 bar (r 1) at 265.5 (x 16 under "For you"), over a
// full-width 0.75 #E9E9E9 line at 267 (from x 2.5).
const LEFTS = [18.7, 114.3, 231.5, 326.9];
const BAR = 59;

/** Not designed: the tabs only switch the highlighted label for now (the feed is the same mock for each). */
export function FeedTabs({ onChange }: { onChange?: (tab: FeedTab) => void }) {
  const [active, setActive] = useState(0);
  const centers = useSharedValue<number[]>([45.5, 0, 0, 0]);
  const x = useSharedValue(16);
  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  const select = (i: number) => {
    if (i === active) return;
    Haptics.selectionAsync();
    setActive(i);
    x.set(withSpring(centers.get()[i] - BAR / 2, { damping: 20, stiffness: 220 }));
    onChange?.(TABS[i]);
  };

  return (
    <View style={styles.root}>
      {TABS.map((label, i) => (
        <Pressable
          key={label}
          onPress={() => select(i)}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === active }}
          onLayout={(e) => {
            const { x: lx, width } = e.nativeEvent.layout;
            // "For you" keeps the frame's bar position; the others centre the bar under their label the same way
            const c = lx + width / 2 + 2;
            centers.set(centers.get().map((v, j) => (j === i && i > 0 ? c : v)));
          }}
          style={[styles.tab, { left: LEFTS[i] }]}>
          <Text style={[styles.label, i === active && styles.labelActive]}>{label}</Text>
        </Pressable>
      ))}
      <View style={styles.line} />
      <Animated.View style={[styles.bar, barStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: 51 },
  tab: { position: 'absolute', top: 18.65 },
  label: { fontFamily: INTER_FAMILIES['500'], fontSize: 14.1, lineHeight: 17, color: '#999999' },
  labelActive: { color: '#000000' },
  line: { position: 'absolute', left: 2.5, right: 0, bottom: 0, height: 0.75, backgroundColor: '#E9E9E9' },
  bar: { position: 'absolute', left: 0, bottom: 0.25, width: BAR, height: 2, borderRadius: 1, backgroundColor: '#2A2121' },
});
