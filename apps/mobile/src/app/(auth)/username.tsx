import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BigInput } from '@/components/big-input';
import { FieldMessage } from '@/components/field-message';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { USERNAME_PATTERN, checkUsernameAvailable, normalizeUsername } from '@/lib/auth';
import { useSession } from '@/state/session';
import { colors } from '@/theme';
import { Text, INTER_FAMILIES } from '@/components/text';
import { push } from '@/lib/nav';

type Status = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const AVAILABLE = new Map<string, boolean>();

export default function UsernameStep() {
  const { draft, updateDraft } = useSession();
  const [username, setUsername] = useState(draft.username);
  const [status, setStatus] = useState<Status>('idle');
  const requestId = useRef(0);

  useEffect(() => {
    if (!username) return setStatus('idle');
    if (!USERNAME_PATTERN.test(username)) return setStatus('invalid');

    // answers are cached, and the request goes out 120ms after the last keystroke (was 300)
    const cached = AVAILABLE.get(username);
    if (cached !== undefined) return setStatus(cached ? 'available' : 'taken');
    setStatus('checking');
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const available = await checkUsernameAvailable(username).catch(() => null);
      if (available !== null) AVAILABLE.set(username, available);
      if (id !== requestId.current) return;
      setStatus(available === null ? 'idle' : available ? 'available' : 'taken');
    }, 120);
    return () => clearTimeout(timer);
  }, [username]);

  const next = () => {
    if (status !== 'available') return;
    updateDraft({ username });
    push('/password');
  };

  return (
    <StepScreen
      title="Create a unique username"
      titleStyle={styles.title}
      footer={
        <PrimaryButton title="Continue" enabled={status === 'available'} onPress={next} />
      }>
      <View style={styles.row}>
        <Text style={styles.at}>@</Text>
        <BigInput
          autoFocus
          value={username}
          onChangeText={(v) => setUsername(normalizeUsername(v))}
          style={styles.input}
          maxLength={30}
          autoCapitalize="none"
          autoComplete="username-new"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={next}
          accessibilityLabel="Username"
        />
      </View>
      <View style={styles.messageSlot}>
        {status === 'taken' ? (
          <FieldMessage tone="error" text="the name is already taken, change or add few letters/numbers" />
        ) : status === 'invalid' ? (
          <FieldMessage text="At least 3 characters: letters, numbers, _ and ." />
        ) : null}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  // AutoLayouted-2: the two-line title is set smaller than the other steps (Inter ExtraBold ~30).
  title: { fontSize: 30, letterSpacing: -0.3 },
  // No layout-1: "@" Inter SemiBold 29.2 at x 13.6, the name 10.65 after it; AutoLayouted-2: the row 4.5 higher than on the other steps.
  row: { flexDirection: 'row', alignItems: 'center', gap: 10.65, marginTop: -4.5 },
  at: { marginLeft: 0.64, fontFamily: INTER_FAMILIES['600'], fontSize: 29.2, lineHeight: 36, color: colors.text },
  input: { paddingLeft: 2 },
  messageSlot: { paddingLeft: 40 },
});
