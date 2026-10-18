import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BigInput } from '@/components/big-input';
import { FieldMessage } from '@/components/field-message';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { useSession } from '@/state/session';
import { isPasswordValid } from '@/lib/auth';
import { push } from '@/lib/nav';

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
        <FieldMessage text="Password must be at least 6 symbol with at least 1 letter" />
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  // AutoLayouted-3: the hint's cap top at 255.6, its text from x 17.8 (two lines, wraps after "with").
  hint: { marginTop: 28.8, paddingLeft: 2.5 },
  row: { flexDirection: 'row' },
});
