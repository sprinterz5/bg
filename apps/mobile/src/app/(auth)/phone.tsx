import { useState } from 'react';
import { Pressable, StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { INTER_FAMILIES, Text } from '@/components/text';
import { checkPhoneAvailable } from '@/lib/auth';
import { push } from '@/lib/nav';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// Frames AutoLayouted-58 / Autolayouted-4 / AutoLayouted-8: "Your phone" with the note under it; between hairlines
// (x 36–360, y 228 / 284 / 340) the country row (flag + "Kazakhstan") and the number row ("+7", a divider at x 124,
// the number in groups "000 000 00 00" that fill in as typed). Continue asks in a sheet "Is this the correct phone
// number?" (Edit / Continue), then the code step. Not designed: other countries (Kazakhstan only for now).
const MASK = '000 000 00 00';
const group = (d: string) => [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ');

export default function PhoneStep() {
  const { draft, updateDraft } = useSession();
  const [digits, setDigits] = useState(draft.phone.replace(/^\+7/, '').replace(/\D/g, '').slice(0, 10));
  const [taken, setTaken] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const typed = group(digits);
  const e164 = digits.length === 10 ? `+7${digits}` : null;

  const next = async () => {
    if (!e164 || checking) return;
    setChecking(true);
    const available = await checkPhoneAvailable(e164).catch(() => true);
    setChecking(false);
    if (!available) return setTaken(true);
    setConfirming(true);
  };
  const confirm = () => {
    setConfirming(false);
    updateDraft({ phone: e164! });
    push('/phone-code');
  };

  return (
    <View style={styles.root}>
      <StepScreen
        title="Your phone"
        subtitle="Enter your phone number to find your contacts on the app and let them find you."
        subtitleStyle={styles.subtitle}
        footer={<PrimaryButton title="Continue" enabled={!!e164 && !taken} loading={checking} onPress={next} />}>
        <View style={styles.table}>
          <View style={styles.country}>
            <Text style={styles.flag}>🇰🇿</Text>
            <Text style={styles.countryName}>Kazakhstan</Text>
          </View>
          <View style={styles.number}>
            <Text style={styles.code}>+7</Text>
            <View style={styles.divider} />
            <View style={styles.field}>
              <Text style={styles.mask} pointerEvents="none">
                <Text style={styles.hidden}>{typed}</Text>
                {MASK.slice(typed.length)}
              </Text>
              <RNTextInput
                autoFocus
                value={typed}
                onChangeText={(v) => {
                  setDigits(v.replace(/\D/g, '').slice(0, 10));
                  setTaken(false);
                }}
                keyboardType="phone-pad"
                autoComplete="tel-national"
                textContentType="telephoneNumber"
                cursorColor={colors.text}
                selectionColor={colors.text}
                onSubmitEditing={next}
                style={styles.input}
                accessibilityLabel="Phone number"
              />
            </View>
          </View>
        </View>
        {taken ? (
          <Animated.View collapsable={false} entering={FadeIn.duration(220)}>
            <Text style={styles.taken}>This number is already used</Text>
          </Animated.View>
        ) : null}
      </StepScreen>
      {confirming ? (
        <>
          <Animated.View collapsable={false} entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, styles.dim]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirming(false)} accessibilityLabel="Edit" />
          </Animated.View>
          <Animated.View
            collapsable={false}
            entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))}
            exiting={SlideOutDown.duration(200)}
            style={styles.sheet}>
            <Text style={styles.sheetNumber}>+7 {typed}</Text>
            <Text style={styles.sheetQuestion}>Is this the correct phone number?</Text>
            <Pressable onPress={() => setConfirming(false)} hitSlop={10} style={styles.edit} accessibilityRole="button">
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
            <PrimaryButton title="Continue" onPress={confirm} />
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const HAIR = '#E6E6E6';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  subtitle: { marginTop: 8, marginLeft: 4, fontSize: 15.5, lineHeight: 22 },
  table: { marginTop: 34, marginLeft: 16, marginRight: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: HAIR },
  country: { height: 55, flexDirection: 'row', alignItems: 'center', paddingLeft: 17, borderBottomWidth: 1, borderColor: HAIR },
  flag: { fontSize: 17, lineHeight: 22 },
  countryName: { marginLeft: 10, fontFamily: INTER_FAMILIES['600'], fontSize: 17, lineHeight: 22, color: '#8E8E8E' },
  number: { height: 55, flexDirection: 'row', alignItems: 'center' },
  code: { width: 88, paddingLeft: 21, fontFamily: INTER_FAMILIES['400'], fontSize: 18, lineHeight: 22, color: colors.text },
  divider: { width: 1, height: 36, backgroundColor: HAIR },
  field: { flex: 1, marginLeft: 13, justifyContent: 'center' },
  mask: { position: 'absolute', left: 0, fontFamily: INTER_FAMILIES['400'], fontSize: 18, lineHeight: 22, letterSpacing: 0.5, color: '#B5B5B5' },
  hidden: { color: 'transparent' },
  input: { padding: 0, fontFamily: INTER_FAMILIES['400'], fontSize: 18, lineHeight: 22, letterSpacing: 0.5, color: colors.text },
  taken: { marginTop: 14, marginLeft: 20, fontFamily: INTER_FAMILIES['400'], fontSize: 15, lineHeight: 20, color: colors.danger },
  dim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  // sits over the keyboard's top like the frame's (x 8–382, r 40)
  sheet: { position: 'absolute', left: 8, right: 8, bottom: 8, paddingTop: 30, paddingHorizontal: 25, paddingBottom: 12, borderRadius: 40, backgroundColor: '#FFFFFF', alignItems: 'stretch' },
  sheetNumber: { textAlign: 'center', fontFamily: INTER_FAMILIES['700'], fontSize: 32, lineHeight: 38, letterSpacing: 0.6, color: colors.text },
  sheetQuestion: { marginTop: 10, textAlign: 'center', fontFamily: INTER_FAMILIES['400'], fontSize: 15, lineHeight: 20, color: '#8E8E8E' },
  edit: { alignSelf: 'center', marginTop: 16, marginBottom: 22 },
  editText: { fontFamily: INTER_FAMILIES['600'], fontSize: 15, lineHeight: 20, color: '#8E8E8E' },
});
