import { Caveat_400Regular } from '@expo-google-fonts/caveat/400Regular';
import { Caveat_500Medium } from '@expo-google-fonts/caveat/500Medium';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Inter_900Black } from '@expo-google-fonts/inter/900Black';
import { Sen_800ExtraBold } from '@expo-google-fonts/sen/800ExtraBold';
import { SourceSerif4_700Bold } from '@expo-google-fonts/source-serif-4/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { installErrorReporting } from '@/lib/report-errors';
import { FeedProvider } from '@/state/feed';
import { SessionProvider } from '@/state/session';
import { DesignOverlay } from '@/components/design-overlay';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

// Inter: where Frame 1198 sets it explicitly (both platforms), and on Android in place of SF Pro (components/text.tsx).
const FONTS = {
  Caveat_400Regular,
  Caveat_500Medium,
  Sen_800ExtraBold,
  SourceSerif4_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
};

installErrorReporting();

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
            {/* The reader animates itself (its cover grows out of the tapped picture); the list stays visible under it. */}
            <Stack.Screen
              name="article/[id]"
              options={{ presentation: 'transparentModal', animation: 'none', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }}
            />
            <Stack.Screen name="story/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="cover-picker" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: '#000000' } }} />
            {/* The viewer animates itself (grows out of the story on Home); Home stays visible around it. */}
            <Stack.Screen
              name="story/[id]"
              options={{ presentation: 'transparentModal', animation: 'none', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }}
            />
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
