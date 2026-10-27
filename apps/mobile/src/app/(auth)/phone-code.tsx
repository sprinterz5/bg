import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput as RNTextInput, View } from 'react-native';

import { StepScreen } from '@/components/step-screen';
import { INTER_FAMILIES, Text } from '@/components/text';
import { push } from '@/lib/nav';
import { colors } from '@/theme';

// Frames Autolayouted-5 / -6: "Enter verification code", the note centred under it, six boxes 54×62 (r 14, stride 60)
// from x 20 at y 252, digits Inter 20. Not designed / not wired: no SMS is sent yet, so any six digits continue.
const BOX = 54;

export default function PhoneCodeStep() {
  const [code, setCode] = useState('');
  const input = useRef<RNTextInput>(null);

  const change = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 6);
    setCode(d);
    if (d.length === 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      push('/username');
    }
  };

  return (
    <StepScreen title="Enter verification code" subtitle="Please enter the code we have sent to your phone messages" subtitleStyle={styles.subtitle}>
      <Pressable onPress={() => input.current?.focus()} style={styles.boxes} accessibilityLabel="Verification code">
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={styles.box}>
            {code[i] ? <Text style={styles.digit}>{code[i]}</Text> : i === code.length ? <View style={styles.caret} /> : null}
          </View>
        ))}
      </Pressable>
      <RNTextInput
        ref={input}
        autoFocus
        value={code}
        onChangeText={change}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
        caretHidden
        style={styles.hiddenInput}
      />
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 10, textAlign: 'center', fontSize: 15.5, lineHeight: 22, paddingHorizontal: 24 },
  boxes: { marginTop: 54, flexDirection: 'row', justifyContent: 'space-between' },
  box: { width: BOX, height: 62, borderRadius: 14, borderWidth: 1, borderColor: '#D9D9D9', alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: INTER_FAMILIES['400'], fontSize: 20, lineHeight: 24, color: colors.text },
  caret: { width: 1.5, height: 26, backgroundColor: colors.text },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
