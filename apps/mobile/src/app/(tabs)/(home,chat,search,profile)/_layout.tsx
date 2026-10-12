import { Stack } from 'expo-router';

import { colors } from '@/theme';

// Each tab (Home, Messages, Search, Profile) has its own stack, so a profile and its Followers / Following open
// inside the tab and the tab bar stays on screen. The same files serve every tab (shared routes).
export default function TabStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    />
  );
}
