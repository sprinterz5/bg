import { Stack } from 'expo-router';

import { colors } from '@/theme';

// Sign-up and log-in start on Welcome (without this the stack opened on its first route by name, the age step).
export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="ready" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
