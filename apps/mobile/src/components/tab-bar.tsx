import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, motion } from '@/theme';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

type TabIcon = { icon: IconName; w: number; h: number; dx?: number };

// Figma: the selected tab uses the filled / heavier variant. Chat has only one variant in the design.
// Profile icons are exported inside differently sized frames, so dx lines their glyphs up.
const TAB_ICONS: Record<string, { label: string; off: TabIcon; on: TabIcon }> = {
  index: { label: 'Home', off: { icon: 'tabHomeInactive', w: 20.6, h: 20.6 }, on: { icon: 'tabHome', w: 20.6, h: 20.6 } },
  create: { label: 'New article', off: { icon: 'tabPlus', w: 20.9, h: 20.9 }, on: { icon: 'tabPlusActive', w: 22, h: 22 } },
  chat: { label: 'Chats', off: { icon: 'tabChat', w: 22.4, h: 21.7 }, on: { icon: 'tabChat', w: 22.4, h: 21.7 } },
  search: { label: 'Search', off: { icon: 'tabSearch', w: 22.3, h: 21.3 }, on: { icon: 'tabSearchActive', w: 23.15, h: 22.15 } },
  profile: { label: 'Profile', off: { icon: 'tabProfile', w: 55, h: 30.75 }, on: { icon: 'tabProfileActive', w: 29, h: 29, dx: 10.5 } },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const meta = TAB_ICONS[route.name];
        if (!meta) return null;
        const focused = state.index === index;

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
            style={styles.tab}>
            <TabGlyph meta={meta} focused={focused} />
          </PressableScale>
        );
      })}
    </View>
  );
}

function TabGlyph({ meta, focused }: { meta: (typeof TAB_ICONS)[string]; focused: boolean }) {
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(focused ? 1 : 0, { duration: motion.fast });
  }, [focused, on]);
  const onStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const offStyle = useAnimatedStyle(() => ({ opacity: 1 - on.value }));

  return (
    <View style={styles.glyph}>
      <Animated.View style={[styles.layer, offStyle]}>
        <Icon name={meta.off.icon} width={meta.off.w} height={meta.off.h} style={meta.off.dx ? { transform: [{ translateX: meta.off.dx }] } : undefined} />
      </Animated.View>
      <Animated.View style={[styles.layer, onStyle]}>
        <Icon name={meta.on.icon} width={meta.on.w} height={meta.on.h} style={meta.on.dx ? { transform: [{ translateX: meta.on.dx }] } : undefined} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 56, height: 32 },
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: 10,
  },
  tab: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center' },
});
