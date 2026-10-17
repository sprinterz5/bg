import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BigInput } from '@/components/big-input';
import { FieldMessage } from '@/components/field-message';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { useSession } from '@/state/session';
import { push } from '@/lib/nav';

const isPasswordValid = (p: string) => p.length >= 6 && /[a-z]/i.test(p) && /\d/.test(p);

export default function PasswordStep() {
  const { draft, updateDraft } = useSession();
  const [password, setPassword] = useState(draft.password);
  const valid = isPasswordValid(password);

  const next = () => {
    if (!valid) return;
    updateDraft({ password });
    push('/password-confirm');
  };

  return (
    <StepScreen title="Create a password" footer={<PrimaryButton title="Continue" enabled={valid} onPress={next} />}>
      <View style={styles.row}>
        <BigInput
          autoFocus
          value={password}
          onChangeText={setPassword}
          maxLength={128}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={next}
          accessibilityLabel="Password"
        />
      </View>
      <View style={styles.hint}>
        <FieldMessage text="Password must be at least 6 letters/ numbers" />
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  // AutoLayouted-2: the hint's cap top 51 under the field line (the message's own 14 plus 27.8).
  hint: { marginTop: 27.8 },
  row: { flexDirection: 'row' },
});
