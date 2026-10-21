import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { BigInput } from '@/components/big-input';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { INTER_FAMILIES, Text } from '@/components/text';
import { checkPhoneAvailable } from '@/lib/auth';
import { formatTyping, toE164 } from '@/lib/phone';
import { push } from '@/lib/nav';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// Not designed: the phone number (after the age), so friends find each other from their contacts. Optional, not
// verified yet (no SMS); the title, field and note follow the age step.
export default function PhoneStep() {
  const { draft, updateDraft } = useSession();
  const [phone, setPhone] = useState(draft.phone);
  const [taken, setTaken] = useState(false);
  const [checking, setChecking] = useState(false);
  const e164 = toE164(phone);

  const next = async () => {
    if (!e164 || checking) return;
    setChecking(true);
    const available = await checkPhoneAvailable(e164).catch(() => true);
    setChecking(false);
    if (!available) return setTaken(true);
    updateDraft({ phone: e164 });
    push('/username');
  };

  const skip = () => {
    updateDraft({ phone: '' });
    push('/username');
  };

  return (
    <StepScreen
      title="Your phone number"
      titleStyle={styles.title}
      footer={
        <View style={styles.buttons}>
          <PrimaryButton title="Continue" enabled={!!e164 && !taken} loading={checking} onPress={next} />
          <PrimaryButton title="Skip" variant="outline" onPress={skip} />
        </View>
      }>
      <View style={styles.row}>
        <BigInput
          autoFocus
          value={phone}
          onChangeText={(v) => {
            setPhone(formatTyping(v.replace(/[^\d+\s()-]/g, '')));
            setTaken(false);
          }}
          placeholder="+7 701 123 45 67"
          maxLength={22}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="next"
          onSubmitEditing={next}
          accessibilityLabel="Phone number"
        />
      </View>
      <Animated.View key={taken ? 'taken' : 'note'} collapsable={false} entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)}>
        <Text style={[styles.note, taken && styles.taken]}>{taken ? 'This number is already used' : 'Friends who have your number will find you'}</Text>
      </Animated.View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 3.5 },
  row: { flexDirection: 'row', marginTop: 1 },
  // the age step's note
  note: { marginTop: 56.8, marginLeft: 8.6, fontFamily: INTER_FAMILIES['400'], fontSize: 16.25, lineHeight: 22.4, color: colors.textMuted },
  taken: { color: colors.danger },
  buttons: { gap: 11.5 },
});
