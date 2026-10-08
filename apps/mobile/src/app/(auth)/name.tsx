import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BigInput } from '@/components/big-input';
import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { Text } from '@/components/text';
import { useSession } from '@/state/session';
import { push } from '@/lib/nav';
import { colors } from '@/theme';

export default function NameStep() {
  const { draft, updateDraft } = useSession();
  const [name, setName] = useState(draft.name);
  const [adult, setAdult] = useState(draft.ageConfirmed);
  const valid = name.trim().length >= 1 && adult;

  const next = () => {
    if (!valid) return;
    updateDraft({ name: name.trim(), ageConfirmed: true });
    push('/username');
  };

  return (
    <StepScreen
      title="Write your name"
      footer={
        <>
          {/* Not in the design: minimum age (13) confirmed before the account is created. */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setAdult((v) => !v);
            }}
            hitSlop={8}
            style={styles.age}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: adult }}>
            <Icon name={adult ? 'checkOn' : 'checkOff'} width={20} />
            <Text style={styles.ageText}>{"I'm 13 or older"}</Text>
          </Pressable>
          <PrimaryButton title="Continue" enabled={valid} onPress={next} />
        </>
      }>
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
  age: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 10, marginBottom: 16 },
  ageText: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: colors.text },
});
