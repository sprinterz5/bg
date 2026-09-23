import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BigInput } from '@/components/big-input';
import { FieldMessage } from '@/components/field-message';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { USERNAME_PATTERN, checkUsernameAvailable, normalizeUsername } from '@/mock/api';
import { useSession } from '@/state/session';
import { colors } from '@/theme';
import { Text } from '@/components/text';
import { push } from '@/lib/nav';

type Status = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function UsernameStep() {
  const { draft, updateDraft } = useSession();
  const [username, setUsername] = useState(draft.username);
  const [status, setStatus] = useState<Status>('idle');
  const requestId = useRef(0);

  useEffect(() => {
    if (!username) return setStatus('idle');
    if (!USERNAME_PATTERN.test(username)) return setStatus('invalid');

    setStatus('checking');
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const available = await checkUsernameAvailable(username);
      if (id === requestId.current) setStatus(available ? 'available' : 'taken');
    }, 300);
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
      footer={
        <PrimaryButton title="Continue" enabled={status === 'available'} onPress={next} />
      }>
      <View style={styles.row}>
        <Text style={styles.at}>@</Text>
        <BigInput
          autoFocus
          value={username}
          onChangeText={(v) => setUsername(normalizeUsername(v))}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  at: { fontSize: 32, fontWeight: '900', color: colors.text, marginTop: -2 },
  messageSlot: { paddingLeft: 40 },
});
