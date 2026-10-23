import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BigInput } from '@/components/big-input';
import { FieldMessage } from '@/components/field-message';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { requestEmailCode } from '@/lib/auth';
import { push } from '@/lib/nav';
import { useSession } from '@/state/session';

// Not designed: the first sign-up step. Only university addresses; a 6-digit code goes there (next step).
const DOMAINS = ['coventry.edu.kz', 'coventry.ac.uk'];
const isUniEmail = (v: string) => /^[^\s@]+@[^\s@]+$/.test(v) && DOMAINS.includes(v.split('@')[1] ?? '');

export default function EmailStep() {
  const { draft, updateDraft } = useSession();
  const [email, setEmail] = useState(draft.email);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const value = email.trim().toLowerCase();
  const valid = isUniEmail(value);

  const next = async () => {
    if (!valid || sending) return;
    setSending(true);
    const result = await requestEmailCode(value);
    setSending(false);
    if (result === 'taken') return setError('This email already has an account. Log in instead');
    if (result === 'domain') return setError('Use your @coventry.edu.kz or @coventry.ac.uk email');
    if (result === 'failed') return setError("Couldn't send the code. Check the connection and try again");
    // 'sent', or 'recent' (a code went out less than a minute ago): either way the code screen
    updateDraft({ email: value, emailToken: '' });
    push('/email-code');
  };

  return (
    <StepScreen
      title="Your university email"
      subtitle="We'll send a code to check it's you"
      footer={<PrimaryButton title="Continue" enabled={valid} loading={sending} onPress={next} />}>
      <View style={styles.row}>
        <BigInput
          autoFocus
          value={email}
          onChangeText={(v) => {
            setEmail(v.replace(/\s/g, ''));
            setError(null);
          }}
          placeholder="name@coventry.edu.kz"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={next}
          accessibilityLabel="University email"
        />
      </View>
      <FieldMessage
        tone={error ? 'error' : 'hint'}
        text={error ?? (value.includes('@') && !valid ? 'Only @coventry.edu.kz and @coventry.ac.uk emails' : 'Only students and staff of Coventry University Kazakhstan')}
      />
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 1 },
});
