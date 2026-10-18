import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { useSession } from '@/state/session';
import { colors, fonts } from '@/theme';
import { AnimatedText, INTER_FAMILIES, Text } from '@/components/text';
import { push } from '@/lib/nav';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { resetDraft } = useSession();

  const createAccount = () => {
    resetDraft();
    push('/name');
  };

  return (
    <View style={styles.root}>
      <View style={styles.main}>
        <AnimatedText entering={FadeIn.duration(700)} style={[styles.logo, { top: insets.top + 185.9 }]}>
          {' Thoughts '}
        </AnimatedText>
        <AnimatedText entering={FadeIn.delay(150).duration(700)} style={[styles.tagline, { top: insets.top + 328.6 }]}>
          Get smarter with friends.
        </AnimatedText>

        <Animated.View collapsable={false} entering={FadeInDown.delay(250).duration(500)} style={[styles.create, { top: insets.top + 570.1 }]}>
          <PressableScale haptic scaleTo={0.97} onPress={createAccount} accessibilityRole="button" style={styles.createButton}>
            <Text style={styles.createText}>Create an account</Text>
          </PressableScale>
        </Animated.View>
      </View>

      <Animated.View collapsable={false} entering={FadeIn.delay(400).duration(500)} style={[styles.bottom, { paddingBottom: insets.bottom + 10.9 }]}>
        <PressableScale onPress={() => push('/login')} style={styles.usernameLink} accessibilityRole="button">
          <Text style={styles.at}>@</Text>
          <Text style={styles.usernameText}>Log in by username</Text>
          <Icon name="chevronRight" width={8.6} height={14.85} tintColor={GRAY} style={styles.chevron} />
        </PressableScale>
      </Animated.View>
    </View>
  );
}

// AutoLayouted (BG(2)), white, y − 47 under the status bar:
// "Thoughts" Caveat 88.4, ink 57.9…327.4 × 258.6; "Get smarter with friends." Inter SemiBold 20.1 #0F1419, ink from 71.6 × 379.9;
// black pill 364×56 (r 28) at 13 × 617.1 with "Create an account" Inter SemiBold 16.3 white (ink 638.2);
// #F5F5F5 bar from 762.1 with "@ Log in by username ›" (#999, Inter SemiBold 15.2 / 15.45), ink tops 784.1 / 783.3, arrow at 282.
const GRAY = '#999999';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  main: { flex: 1 },
  // The frame's Caveat is 7% taller for its width than the font file (another cut): scaleY makes up for it.
  // lineHeight ≥ 1.26em (Caveat with descenders) so Android doesn't clip; NBSPs keep the overhanging glyphs inside.
  logo: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: fonts.logo, fontSize: 88.4, lineHeight: 114, color: colors.text, transform: [{ translateX: -12.5 }, { scaleY: 1.072 }] },
  tagline: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: INTER_FAMILIES['600'], fontSize: 20.1, lineHeight: 25, color: '#0F1419', transform: [{ translateX: -2.4 }] },
  create: { position: 'absolute', left: 13, right: 13 },
  createButton: { height: 56, borderRadius: 28, backgroundColor: '#000000', alignItems: 'center', paddingTop: 17.2 },
  createText: { fontFamily: INTER_FAMILIES['600'], fontSize: 16.3, lineHeight: 20, color: '#FFFFFF', transform: [{ translateX: -1 }] },
  bottom: { backgroundColor: '#F5F5F5', paddingTop: 18, alignItems: 'center' },
  usernameLink: { flexDirection: 'row', alignItems: 'flex-start', transform: [{ translateX: 3 }] },
  at: { fontFamily: INTER_FAMILIES['600'], fontSize: 15.2, lineHeight: 19, color: GRAY },
  usernameText: { marginLeft: 7, fontFamily: INTER_FAMILIES['600'], fontSize: 15.45, lineHeight: 19, color: GRAY },
  chevron: { marginLeft: 8.5, marginTop: 2.6 },
});
