import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BigInput } from '@/components/big-input';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { useSession } from '@/state/session';

export default function NameStep() {
  const { draft, updateDraft } = useSession();
  const [name, setName] = useState(draft.name);
  const valid = name.trim().length >= 1;

  const next = () => {
    if (!valid) return;
    updateDraft({ name: name.trim() });
    router.push('/username');
  };

  return (
    <StepScreen
      title="Write your name"
      footer={<PrimaryButton title="Continue" enabled={valid} onPress={next} />}>
      <View style={styles.row}>
        <BigInput
          autoFocus
          value={name}
          onChangeText={setName}
          maxLength={60}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={next}
          accessibilityLabel="Your name"
        />
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
