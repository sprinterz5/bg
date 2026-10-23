import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { BigInput } from '@/components/big-input';
import { FieldMessage } from '@/components/field-message';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { INTER_FAMILIES, Text } from '@/components/text';
import { requestEmailCode, verifyEmailCode } from '@/lib/auth';
import { push } from '@/lib/nav';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// Not designed: the 6-digit code from the email; it's checked as soon as the 6th digit is typed. A wrong code
// shakes the field; "Send again" works after a minute.
const RESEND_S = 60;

export default function EmailCodeStep() {
  const { draft, updateDraft } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [wait, setWait] = useState(RESEND_S);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const check = async (value: string) => {
    if (value.length !== 6 || checking) return;
    setChecking(true);
    const token = await verifyEmailCode(draft.email, value);
    setChecking(false);
    if (!token) {
      setError('Wrong or expired code');
      setCode('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      shake.set(withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 70 }), withTiming(-6, { duration: 60 }), withTiming(0, { duration: 50 })));
      return;
    }
    updateDraft({ emailToken: token });
    push('/name');
  };

  const resend = async () => {
    if (wait > 0) return;
    setWait(RESEND_S);
    setError(null);
    const result = await requestEmailCode(draft.email);
    if (result === 'failed') setError("Couldn't send the code. Try again in a minute");
  };

  return (
    <StepScreen
      title="Enter the code"
      subtitle={`We sent 6 digits to ${draft.email}`}
      footer={<PrimaryButton title="Continue" enabled={code.length === 6} loading={checking} onPress={() => check(code)} />}>
      <Animated.View collapsable={false} style={[styles.row, shakeStyle]}>
        <BigInput
          autoFocus
          value={code}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, '').slice(0, 6);
            setCode(digits);
            setError(null);
            if (digits.length === 6) check(digits);
          }}
          placeholder="000000"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          accessibilityLabel="Code from the email"
          style={styles.code}
        />
      </Animated.View>
      {error ? <FieldMessage tone="error" text={error} /> : <FieldMessage text="Check the spam folder if it isn't there" />}
      <View style={styles.resendRow}>
        <Pressable onPress={resend} disabled={wait > 0} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.resend, wait > 0 && styles.resendOff]}>{wait > 0 ? `Send again in ${wait}s` : 'Send again'}</Text>
        </Pressable>
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 1 },
  code: { letterSpacing: 6 },
  resendRow: { marginTop: 18, marginLeft: 4.5, flexDirection: 'row' },
  resend: { fontFamily: INTER_FAMILIES['600'], fontSize: 14.5, lineHeight: 18, color: colors.text },
  resendOff: { fontFamily: INTER_FAMILIES['400'], color: colors.textMuted },
});
