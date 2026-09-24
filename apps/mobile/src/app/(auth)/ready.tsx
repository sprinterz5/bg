import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { completeSignup } from '@/lib/auth';
import { useSession } from '@/state/session';
import { colors, fonts } from '@/theme';
import { AnimatedText } from '@/components/text';

const MIN_SPLASH_MS = 1100;

export default function Ready() {
  const { draft, signIn, resetDraft } = useSession();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });

    let cancelled = false;
    const started = Date.now();
    completeSignup(draft).then((user) => {
      const remaining = Math.max(0, MIN_SPLASH_MS - (Date.now() - started));
      setTimeout(() => {
        if (cancelled) return;
        signIn(user);
        resetDraft();
        router.replace('/(tabs)');
      }, remaining);
    }, (e) => {
      if (cancelled) return;
      // Username taken meanwhile, provider token expired or no network: start over from the provider sheet.
      Alert.alert('Could not create the account', e instanceof Error ? e.message : 'Try again.');
      resetDraft();
      router.replace('/welcome');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.92 + 0.08 * progress.value }, { rotate: '-1deg' }],
  }));

  return (
    <View style={styles.root}>
      <AnimatedText style={[styles.logo, logoStyle]}>Bookgram</AnimatedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  logo: { fontFamily: fonts.logo, fontSize: 64, lineHeight: 76, color: colors.text, letterSpacing: -1.5 },
});
