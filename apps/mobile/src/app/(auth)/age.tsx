import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { BigInput } from '@/components/big-input';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { INTER_FAMILIES, Text } from '@/components/text';
import { useSession } from '@/state/session';
import { colors } from '@/theme';
import { push } from '@/lib/nav';

const MIN_AGE = 13;

/** AutoLayouted-3 / -4 (TH(2)): between the name and the username; under 13 the button greys out and says why. */
export default function AgeStep() {
  const { updateDraft } = useSession();
  const [age, setAge] = useState('');
  const n = Number(age);
  const tooYoung = age.length > 0 && n < MIN_AGE;
  const valid = age.length > 0 && n >= MIN_AGE && n <= 120;

  const next = () => {
    if (!valid) return;
    updateDraft({ ageConfirmed: true });
    push('/username');
  };

  return (
    <StepScreen
      title="Tell us about your age"
      titleStyle={styles.title}
      footer={<PrimaryButton title="Continue" enabled={valid} onPress={next} />}>
      <View style={styles.row}>
        <BigInput
          autoFocus
          value={age}
          onChangeText={(v) => setAge(v.replace(/\D/g, '').replace(/^0+/, ''))}
          maxLength={3}
          keyboardType="number-pad"
          returnKeyType="next"
          onSubmitEditing={next}
          accessibilityLabel="Your age"
        />
      </View>
      {tooYoung ? (
        <Animated.View collapsable={false} entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)}>
          <Text style={styles.sorry} numberOfLines={1}>
            Sorry, you must be 13 or older to continue
          </Text>
        </Animated.View>
      ) : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  // title ink 105.7, the field where the name's is (caret at 178)
  title: { marginTop: 3.5 },
  row: { flexDirection: 'row', marginTop: 1 },
  // ink from (24.9, 274.6), Inter 16.25 #8C8C8C on one line
  sorry: { marginTop: 56.8, marginLeft: 8.6, fontFamily: INTER_FAMILIES['400'], fontSize: 16.25, lineHeight: 22.4, color: colors.textMuted },
});
