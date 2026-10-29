import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { homeChromeHidden } from '@/lib/chrome';
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
    off: { icon: 'tabHomeInactive', w: 19.8296, h: 18.9674, cx: 38.25, cy: 24.5 },
    on: { icon: 'tabHome', w: 19.8296, h: 18.9674, cx: 39.25, cy: 24.5 },
  },
  // The messages icon has a single variant in the design.
  '(chat)': {
    label: 'Messages',
    off: { icon: 'tabMessages', w: 19.91, h: 19.24, cx: 109.27, cy: 25.9 },
    on: { icon: 'tabMessages', w: 19.91, h: 19.24, cx: 109.27, cy: 25.9 },
  },
  create: {
    label: 'New article',
    off: { icon: 'tabCreate', w: 21.68, h: 21.68, cx: 192, cy: 26.25 },
    on: { icon: 'tabCreateActive', w: 22.53, h: 22.53, cx: 192.5, cy: 26.25 },
  },
  '(search)': {
    label: 'Search',
    off: { icon: 'tabSearch', w: 19.55, h: 19.55, cx: 272.75, cy: 25.63 },
    on: { icon: 'tabSearchActive', w: 20.4, h: 20.4, cx: 272.75, cy: 25.63 },
  },
  // No new selected profile icon yet: the old filled one, its glyph centred where the outline one is.
  '(profile)': {
    label: 'Profile',
    off: { icon: 'tabProfile', w: 22.1, h: 21.15, cx: 348.25, cy: 25.32 },
    on: { icon: 'tabProfileActive', w: 24.65, h: 24.65, cx: 349.25, cy: 25.67 },
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
  const height = BAR_H + bottom;
  const slide = useAnimatedStyle(() => (onHome ? { transform: [{ translateY: homeChromeHidden.get() * (height + 1) }] } : {}));

  return (
    <Animated.View style={[styles.bar, { height }, onHome && styles.floating, onHome && styles.homeBar, slide]}>
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
  floating: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  homeBar: { backgroundColor: '#FAFAFA' },
  tab: { position: 'absolute', top: 1, width: TAB_W, height: BAR_H + 1 },
  layer: { position: 'absolute' },
});
