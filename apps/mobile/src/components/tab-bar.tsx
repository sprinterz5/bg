import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, motion } from '@/theme';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

// Figma (Explore frame THIS.svg): icons are NOT on equal columns. cx / cy are each glyph's centre: x from the screen's left edge (design width
// 390, scaled on other widths), y from the hairline on top of the bar.
type Glyph = { icon: IconName; w: number; h: number; cx: number; cy: number };

const TABS: Record<string, { label: string; off: Glyph; on: Glyph }> = {
  index: {
    label: 'Home',
    off: { icon: 'tabHomeInactive', w: 22.99, h: 22, cx: 38.25, cy: 24.5 },
    on: { icon: 'tabHome', w: 23, h: 22, cx: 39.25, cy: 24.5 },
  },
  // The messages icon has a single variant in the design.
  chat: {
    label: 'Messages',
    off: { icon: 'tabMessages', w: 23.42, h: 22.64, cx: 109.27, cy: 25.9 },
    on: { icon: 'tabMessages', w: 23.42, h: 22.64, cx: 109.27, cy: 25.9 },
  },
  create: {
    label: 'New article',
    off: { icon: 'tabCreate', w: 25.5, h: 25.5, cx: 192, cy: 26.25 },
    on: { icon: 'tabCreateActive', w: 26.5, h: 26.5, cx: 192.5, cy: 26.25 },
  },
  search: {
    label: 'Search',
    off: { icon: 'tabSearch', w: 23, h: 23, cx: 272.75, cy: 25.63 },
    on: { icon: 'tabSearchActive', w: 24, h: 24, cx: 272.75, cy: 25.63 },
  },
  // No new selected profile icon yet: the old filled one, its glyph centred where the outline one is.
  profile: {
    label: 'Profile',
    off: { icon: 'tabProfile', w: 26, h: 24.88, cx: 348.25, cy: 25.32 },
    on: { icon: 'tabProfileActive', w: 29, h: 29, cx: 349.25, cy: 25.67 },
  },
};

const BAR_H = 47; // hairline → where the home indicator area starts (81 - 34 in the frame)
const TAB_W = 64;

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const k = width / 390;
  // iPhone: the 34px home indicator inset. Android 3-button nav reports 0–48; keep a small gap either way.
  const bottom = Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 12);

  return (
    <View style={[styles.bar, { height: BAR_H + bottom }]}>
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const cx = meta.off.cx * k;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <PressableScale
            key={route.key}
            haptic={!focused}
            scaleTo={0.86}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            style={[styles.tab, { left: cx - TAB_W / 2 }]}>
            <TabGlyph meta={meta} focused={focused} k={k} />
          </PressableScale>
        );
      })}
    </View>
  );
}

function TabGlyph({ meta, focused, k }: { meta: (typeof TABS)[string]; focused: boolean; k: number }) {
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(focused ? 1 : 0, { duration: motion.fast });
  }, [focused, on]);
  const onStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const offStyle = useAnimatedStyle(() => ({ opacity: 1 - on.value }));

  // Glyph position inside the tab: the tab is centred on the "off" glyph's x.
  const place = (g: Glyph) => ({ left: TAB_W / 2 + (g.cx - meta.off.cx) * k - g.w / 2, top: g.cy - g.h / 2 });

  return (
    <>
      <Animated.View style={[styles.layer, place(meta.off), offStyle]}>
        <Icon name={meta.off.icon} width={meta.off.w} height={meta.off.h} />
      </Animated.View>
      <Animated.View style={[styles.layer, place(meta.on), onStyle]}>
        <Icon name={meta.on.icon} width={meta.on.w} height={meta.on.h} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.bg,
    borderTopWidth: 0.35,
    borderTopColor: '#E5E5E5',
  },
  tab: { position: 'absolute', top: 0, width: TAB_W, height: BAR_H },
  layer: { position: 'absolute' },
});
