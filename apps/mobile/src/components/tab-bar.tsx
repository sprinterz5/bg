import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, motion } from '@/theme';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

// Keys are the tab routes: each tab but Create is a group with its own stack.
// Figma (Explore frame THIS.svg): icons are NOT on equal columns. cx / cy are each glyph's centre: x from the screen's left edge (design width
// 390, scaled on other widths), y from the hairline on top of the bar.
type Glyph = { icon: IconName; w: number; h: number; cx: number; cy: number };

const TABS: Record<string, { label: string; off: Glyph; on: Glyph }> = {
  '(home)': {
    label: 'Home',
    off: { icon: 'tabHomeInactive', w: 20.82, h: 19.92, cx: 39.25, cy: 22.5 },
    on: { icon: 'tabHome', w: 20.82, h: 19.92, cx: 39.25, cy: 22.5 },
  },
  // The messages icon has a single variant in the design.
  '(chat)': {
    label: 'Messages',
    off: { icon: 'tabMessages', w: 20.91, h: 20.2, cx: 109.27, cy: 23.9 },
    on: { icon: 'tabMessages', w: 20.91, h: 20.2, cx: 109.27, cy: 23.9 },
  },
  create: {
    label: 'New article',
    off: { icon: 'tabCreate', w: 22.76, h: 22.76, cx: 192, cy: 24.25 },
    on: { icon: 'tabCreateActive', w: 23.66, h: 23.66, cx: 192.5, cy: 24.25 },
  },
  '(search)': {
    label: 'Search',
    off: { icon: 'tabSearch', w: 21.15, h: 21.15, cx: 272.75, cy: 23.43 },
    on: { icon: 'tabSearchActive', w: 22.06, h: 22.06, cx: 272.75, cy: 23.43 },
  },
  // No new selected profile icon yet: the old filled one, its glyph centred where the outline one is.
  '(profile)': {
    label: 'Profile',
    off: { icon: 'tabProfile', w: 23.21, h: 22.21, cx: 348.25, cy: 23.32 },
    on: { icon: 'tabProfileActive', w: 25.88, h: 25.88, cx: 349.25, cy: 23.67 },
  },
};

const BAR_H = 48.5; // hairline → where the home indicator area starts (81 - 34 in the frame); the icons sit as if it were 48
const TAB_W = 64;

export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const k = width / 390;
  // iPhone: the 34px home indicator inset. Android 3-button nav reports 0–48; keep a small gap either way.
  const bottom = Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 12);

  // On Home the bar floats over the feed and slides away with the top bar while scrolling down (lib/chrome).
  const onHome = state.routes[state.index]?.name === '(home)';
  // 4 taller on every tab (the buttons sit 4 higher): the same height everywhere, so the bar doesn't move when
  // switching tabs; the background reaches the screen's bottom edge.
  const height = BAR_H + bottom + 4;
  return (
    <Animated.View style={[styles.bar, { height }, onHome && styles.floating, onHome && styles.homeBar]}>
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const cx = meta.off.cx * k;

        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
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
    </Animated.View>
  );
}

function TabGlyph({ meta, focused, k }: { meta: (typeof TABS)[string]; focused: boolean; k: number }) {
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(focused ? 1 : 0, { duration: motion.fast }));
  }, [focused, on]);
  const onStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const offStyle = useAnimatedStyle(() => ({ opacity: 1 - on.value }));

  // Glyph position inside the tab: the tab is centred on the "off" glyph's x.
  const place = (g: Glyph) => ({ left: TAB_W / 2 + (g.cx - meta.off.cx) * k - g.w / 2, top: g.cy - g.h / 2 });

  return (
    <>
      <Animated.View collapsable={false} style={[styles.layer, place(meta.off), offStyle]}>
        <Icon name={meta.off.icon} width={meta.off.w} height={meta.off.h} />
      </Animated.View>
      <Animated.View collapsable={false} style={[styles.layer, place(meta.on), onStyle]}>
        <Icon name={meta.on.icon} width={meta.on.w} height={meta.on.h} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.bg,
    borderTopWidth: 0.75,
    borderTopColor: '#E5E5E5',
  },
  floating: { position: 'absolute', left: 0, right: 0, bottom: -2},
  homeBar: { backgroundColor: '#FFFFFF' },
  tab: { position: 'absolute', top: 0.15, width: TAB_W, height: BAR_H + 1, transform: [{ translateY: 1.5 }, { scale: 1.05 }] },
  layer: { position: 'absolute' },
});
