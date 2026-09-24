import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { socialSignIn } from '@/lib/auth';
import { useSession } from '@/state/session';
import { colors, fonts } from '@/theme';
import { AnimatedText, Text } from '@/components/text';
import { push } from '@/lib/nav';

type Provider = 'google' | 'apple';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { resetDraft, signIn } = useSession();
  const [pending, setPending] = useState<Provider | null>(null);

  const onSocial = async (provider: Provider) => {
    if (pending) return;
    setPending(provider);
    try {
      const result = await socialSignIn(provider);
      if (result.kind === 'signedIn') {
        signIn(result.user);
        router.replace('/(tabs)');
      } else if (result.kind === 'signup') {
        resetDraft({ provider, identityToken: result.identityToken });
        push('/name');
      }
    } catch (e) {
      Alert.alert('Could not sign in', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.main, { paddingTop: insets.top + LOGO_TOP }]}>
      <View style={styles.hero}>
        <AnimatedText entering={FadeIn.duration(700)} style={styles.logo}>
          Bookgram
        </AnimatedText>
        <AnimatedText entering={FadeInDown.delay(180).duration(500)} style={styles.tagline}>
          The world`s first healthy social media
        </AnimatedText>
      </View>

      <Animated.View entering={FadeInDown.delay(360).duration(500)} style={styles.auth}>
        <Text style={styles.authLabel}>Log in/ Create an account:</Text>
        <View style={styles.socialRow}>
          {(['google', 'apple'] as const).map((p) => (
            <PressableScale
              key={p}
              haptic
              scaleTo={0.9}
              onPress={() => onSocial(p)}
              accessibilityRole="button"
              accessibilityLabel={p === 'google' ? 'Continue with Google' : 'Continue with Apple'}
              style={styles.social}>
              <Icon name="socialCircle" width={61} style={StyleSheet.absoluteFill} />
              {pending === p ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Icon name={p} width={28} style={p === 'apple' ? styles.appleNudge : undefined} />
              )}
            </PressableScale>
          ))}
        </View>
      </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(500).duration(500)} style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <PressableScale onPress={() => push('/login')} style={styles.usernameLink} accessibilityRole="button">
          <Text style={styles.at}>@</Text>
          <Text style={styles.usernameText}>Log in by username</Text>
          <Icon name="chevronRight" width={7} height={12} tintColor={colors.textGray} />
        </PressableScale>
      </Animated.View>
    </View>
  );
}

// From Figma frame 3086:387 (status bar 47): logo glyph center y≈271, label y=578, buttons y=622.
const LOGO_TOP = 176;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  main: { flex: 1 },
  hero: { alignItems: 'center', paddingHorizontal: 40 },
  logo: {
    fontFamily: fonts.logo,
    fontSize: 82,
    lineHeight: 96,
    color: colors.text,
    letterSpacing: -2.4,
    transform: [{ rotate: '-1deg' }],
  },
  tagline: {
    marginTop: 14,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: -0.7,
  },
  auth: { alignItems: 'center', gap: 27, marginTop: 181 },
  authLabel: { fontSize: 14.5, fontWeight: '600', color: colors.text },
  socialRow: { flexDirection: 'row', gap: 62, marginRight: 12 },
  social: { width: 61, height: 61, alignItems: 'center', justifyContent: 'center' },
  appleNudge: { marginTop: -2 },
  bottom: { backgroundColor: colors.surface, paddingTop: 18, alignItems: 'center' },
  usernameLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  at: { fontSize: 17, fontWeight: '700', color: colors.textGray },
  usernameText: { fontSize: 16, fontWeight: '600', color: colors.textGray },
});
