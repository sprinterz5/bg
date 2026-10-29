import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View, type TextInputInstance } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { loginWithUsername, normalizeUsername } from '@/lib/auth';
import { looksLikePhone } from '@/lib/phone';
import { useSession } from '@/state/session';
import { colors, fonts } from '@/theme';
import { AnimatedText, INTER_FAMILIES, Text, TextInput } from '@/components/text';
import { push } from '@/lib/nav';

// AutoLayouted (TH(2)): the first screen is the sign-in itself, y − 47 under the status bar.
// "Thoughts" Caveat, ink 215.7×67.8 from (89.6, 183.7) — the frame's cut is 13% taller than the font file,
// scaleY makes up for it; two #F5F5F5 fields 344.5×48.5 (r 8.8, 0.5 #D9D9D9) at (23.2, 308.4) and 64 lower,
// placeholders Inter 13.9 #999 16 in; "Log in" black pill 345×53 (r 26.5) at 453.1, Inter SemiBold 14.6 white;
// "Forgotten password?" Inter SemiBold 14 #999 (ink 523.8); "Create new account" outlined pill (1 #D9D9D9) at 697,
// Inter SemiBold 15 #999 — kept 60 above the home indicator.
const GRAY = '#999999';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { signIn, resetDraft } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const at = (y: number) => insets.top + y - 47;

  const submit = async () => {
    if (username.length < 3 || password.length < 6) {
      setError(username.length > 0 || password.length > 0);
      return;
    }
    if (loading) return;
    setLoading(true);
    setError(false);
    const user = await loginWithUsername(username, password).catch(() => null);
    setLoading(false);
    if (!user) return setError(true);
    signIn(user);
    router.replace('/');
  };

  const createAccount = () => {
    resetDraft();
    push('/name');
  };

  // Not designed: password recovery needs an email, which accounts no longer have.
  const forgot = () => Alert.alert('Recover your password', 'Password recovery is coming soon.');

  return (
    <View style={styles.root}>
      <AnimatedText entering={FadeIn.duration(600)} style={[styles.logo, { top: at(168) }]}>
        Thoughts
      </AnimatedText>

      <Animated.View collapsable={false} entering={FadeInDown.delay(120).duration(450)} style={[styles.form, { top: at(308.4) }]}>
        <TextInput
          value={username}
          onChangeText={(v) => {
            // a phone number keeps its "+" and spaces; the rest is a username
            setUsername(/^[+\d]/.test(v) && looksLikePhone(v.padEnd(6, '0')) ? v : normalizeUsername(v));
            setError(false);
          }}
          placeholder="Username or phone number"
          placeholderTextColor={GRAY}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          style={styles.field}
          accessibilityLabel="Username"
        />
        <TextInput
          ref={passwordRef}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(false);
          }}
          placeholder="Password"
          placeholderTextColor={GRAY}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          style={[styles.field, styles.second]}
          accessibilityLabel="Password"
        />
        <PressableScale haptic scaleTo={0.97} onPress={submit} accessibilityRole="button" accessibilityLabel="Log in" style={styles.login}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginText}>Log in</Text>}
        </PressableScale>
        {/* Not designed: a failed sign-in replaces the recovery link with the error for a moment */}
        <Pressable onPress={forgot} hitSlop={8} style={styles.forgot} accessibilityRole="button">
          <Text style={[styles.forgotText, error && styles.errorText]}>{error ? 'Wrong username or password' : <>Forgot your password details? <Text style={styles.recover}>Recover it</Text></>}</Text>
        </Pressable>
      </Animated.View>

      <Animated.View collapsable={false} entering={FadeIn.delay(300).duration(450)} style={[styles.bottom, { bottom: insets.bottom + 60 }]}>
        <PressableScale scaleTo={0.97} onPress={createAccount} accessibilityRole="button" style={styles.create}>
          <Text style={styles.createText}>Create account</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  // Caveat SemiBold (closest by pixels); ink left 11.1 / top 18.8 inside a 69.6 / 83.5 line box, scaleY about its centre
  logo: { position: 'absolute', left: 78.5, width: 300, fontFamily: fonts.logoSemi, fontSize: 69.6, lineHeight: 83.5, color: colors.text, transform: [{ scaleY: 1.134 }] },
  form: { position: 'absolute', left: 23.2, right: 22.3 },
  field: { height: 48.5, borderRadius: 8.8, borderWidth: 0.5, borderColor: '#D9D9D9', backgroundColor: '#F5F5F5', paddingHorizontal: 17.1, paddingVertical: 0, fontFamily: INTER_FAMILIES['400'], fontSize: 13.9, color: colors.text },
  second: { marginTop: 15.5 },
  login: { marginTop: 32.2, marginLeft: -0.2, height: 53, borderRadius: 26.5, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  loginText: { fontFamily: INTER_FAMILIES['600'], fontSize: 14.6, lineHeight: 17.6, color: '#FFFFFF' },
  // ink 523.8 = 17.7 under the pill, 3.2 into a 16.9 line box
  forgot: { alignSelf: 'center', marginTop: 14.5 },
  recover: { fontFamily: INTER_FAMILIES['600'], color: colors.text },
  forgotText: { fontFamily: INTER_FAMILIES['600'], fontSize: 14, lineHeight: 16.9, color: GRAY },
  errorText: { color: colors.danger },
  bottom: { position: 'absolute', left: 23, right: 22 },
  create: { height: 53, borderRadius: 26.5, borderWidth: 1, borderColor: '#D9D9D9', alignItems: 'center', justifyContent: 'center' },
  createText: { fontFamily: INTER_FAMILIES['600'], fontSize: 15, lineHeight: 18, color: GRAY },
});
