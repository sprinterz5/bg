import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

const TAB_ICONS: Record<string, { icon: IconName; w: number; h: number; label: string }> = {
  index: { icon: 'tabHome', w: 20.6, h: 20.6, label: 'Home' },
  create: { icon: 'tabPlus', w: 20.9, h: 20.9, label: 'New article' },
  chat: { icon: 'tabChat', w: 22.4, h: 21.7, label: 'Chats' },
  search: { icon: 'tabSearch', w: 22.3, h: 21.3, label: 'Search' },
  profile: { icon: 'tabProfile', w: 55, h: 30.75, label: 'Profile' },
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
            <Icon name={meta.icon} width={meta.w} height={meta.h} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: 10,
  },
  tab: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center' },
});
