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
import { AnimatedText, INTER_FAMILIES, Text } from '@/components/text';
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
        router.replace('/');
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
      <View style={styles.main}>
        <AnimatedText entering={FadeIn.duration(700)} style={[styles.logo, { top: insets.top + 228.2 }]}>
          {' Thoughts '}
        </AnimatedText>

        <Animated.View collapsable={false} entering={FadeInDown.delay(250).duration(500)} style={[styles.auth, { top: insets.top + 504.9 }]}>
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

      <Animated.View collapsable={false} entering={FadeIn.delay(400).duration(500)} style={[styles.bottom, { paddingBottom: insets.bottom + 13.7 }]}>
        <PressableScale onPress={() => push('/login')} style={styles.usernameLink} accessibilityRole="button">
          <Text style={styles.at}>@</Text>
          <Text style={styles.usernameText}>Log in by username</Text>
          <Icon name="chevronRight" width={8.6} height={14.85} tintColor={GRAY} style={styles.chevron} />
        </PressableScale>
      </Animated.View>
    </View>
  );
}

// Auto_layouted (white, y − 47 under the status bar): "Thoughts" Caveat SemiBold 82.75, line box at 228.2 (ink 302–378, centred on x 194.4);
// "Log in/ Create an account:" Inter 14.5 semibold at 504.9 centred on x 188; the 61px circles at 550.1 centred on
// x 185 (62 apart); a #F5F5F5 bar 84.9 tall at the bottom with "@ Log in by username ›" (#999, Inter 15.9 semibold).
const GRAY = '#999999';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  main: { flex: 1 },
  // lineHeight ≥ 1.26em (Caveat with descenders) so Android doesn't clip; NBSPs keep the overhanging glyphs inside.
  logo: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: fonts.logoSemi, fontSize: 82.75, lineHeight: 108, color: colors.text, transform: [{ translateX: -11.1 }] },
  auth: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  authLabel: { transform: [{ translateX: -7 }], fontFamily: INTER_FAMILIES['600'], fontSize: 14.5, lineHeight: 18, color: '#000000' },
  socialRow: { marginTop: 27.28, flexDirection: 'row', gap: 62, marginRight: 20 },
  social: { width: 61, height: 61, alignItems: 'center', justifyContent: 'center' },
  appleNudge: { marginTop: -2 },
  bottom: { backgroundColor: '#F5F5F5', paddingTop: 17.14, alignItems: 'center' },
  usernameLink: { flexDirection: 'row', alignItems: 'center', transform: [{ translateX: -2.7 }] },
  at: { fontFamily: INTER_FAMILIES['600'], fontSize: 15.3, lineHeight: 20, color: GRAY },
  usernameText: { marginLeft: 7.5, fontFamily: INTER_FAMILIES['600'], fontSize: 15.9, lineHeight: 20, color: GRAY },
  chevron: { marginLeft: 8.8 },
});
