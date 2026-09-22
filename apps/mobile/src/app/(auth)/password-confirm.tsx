import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BigInput } from '@/components/big-input';
import { FieldMessage } from '@/components/field-message';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { useSession } from '@/state/session';

export default function PasswordConfirmStep() {
  const { draft } = useSession();
  const [value, setValue] = useState('');
  const matches = value === draft.password && value.length > 0;
  const mismatch = value.length >= draft.password.length && !matches;

  const next = () => {
    if (matches) router.push('/avatar');
  };

  return (
    <StepScreen title="Repeat the password" footer={<PrimaryButton title="Continue" enabled={matches} onPress={next} />}>
      <View style={styles.row}>
        <BigInput
          autoFocus
          value={value}
          onChangeText={setValue}
          maxLength={128}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={next}
          accessibilityLabel="Repeat password"
        />
      </View>
      {mismatch ? <FieldMessage tone="error" text="passwords don`t match" /> : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
