import { Caveat_400Regular } from '@expo-google-fonts/caveat/400Regular';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Inter_900Black } from '@expo-google-fonts/inter/900Black';
import { Sen_800ExtraBold } from '@expo-google-fonts/sen/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedProvider } from '@/state/feed';
import { SessionProvider } from '@/state/session';
import { DesignOverlay } from '@/components/design-overlay';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

// Android stands in Inter for SF Pro (see components/text.tsx); iOS uses the system font like Figma.
const FONTS = {
  Caveat_400Regular,
  Sen_800ExtraBold,
  ...(Platform.OS === 'android'
    ? { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black }
    : {}),
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <SafeAreaProvider>
        <SessionProvider>
        <FeedProvider>
          <StatusBar style="dark" />
          <DesignOverlay>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}>
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="article/[id]" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
            <Stack.Screen name="story/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="new-article" />
          </Stack>
          </DesignOverlay>
        </FeedProvider>
        </SessionProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
