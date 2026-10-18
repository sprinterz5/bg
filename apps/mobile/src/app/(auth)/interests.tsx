import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { StepScreen } from '@/components/step-screen';
import { INTERESTS, INTERESTS_MAX, INTERESTS_MIN } from '@/mock/data';
import { useSession } from '@/state/session';
import { colors } from '@/theme';
import { AnimatedText, Text, INTER_FAMILIES } from '@/components/text';
import { push } from '@/lib/nav';

export default function InterestsStep() {
  const { draft, updateDraft } = useSession();
  const [selected, setSelectedState] = useState<string[]>(draft.interests);
  const selectedRef = useRef(selected);
  const shake = useSharedValue(0);
  const valid = selected.length >= INTERESTS_MIN && selected.length <= INTERESTS_MAX;

  const setSelected = (next: string[]) => {
    selectedRef.current = next;
    setSelectedState(next);
  };

  const toggle = (slug: string) => {
    const current = selectedRef.current;
    if (current.includes(slug)) {
      Haptics.selectionAsync();
      setSelected(current.filter((x) => x !== slug));
      return;
    }
    if (current.length >= INTERESTS_MAX) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      shake.set(withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 70 }),
        withTiming(-3, { duration: 60 }),
        withTiming(0, { duration: 50 }),
      ));
      return;
    }
    Haptics.selectionAsync();
    setSelected([...current, slug]);
  };

  const subtitleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const next = () => {
    if (!valid) return;
    updateDraft({ interests: selected });
    push('/ready');
  };

  return (
    <StepScreen
      title="Pick your interests"
      showBack={false}
      titleStyle={styles.title}
      gutter={18}
      titleTop={39}
      footerLift={15}
      avoidKeyboard={false}
      footer={
        <View style={styles.footer}>
          <PrimaryButton title="Continue" enabled={valid} onPress={next} />
        </View>
      }>
      <AnimatedText style={[styles.subtitle, subtitleStyle]}>
        Select from {INTERESTS_MIN} to {INTERESTS_MAX} topics to continue
      </AnimatedText>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {INTERESTS.map((item) => (
          <InterestRow
            key={item.slug}
            label={item.label}
            checked={selected.includes(item.slug)}
            onPress={() => toggle(item.slug)}
          />
        ))}
      </ScrollView>
    </StepScreen>
  );
}

function InterestRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  const progress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    progress.set(withSpring(checked ? 1 : 0, { damping: 14, stiffness: 260 }));
  }, [checked, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.6 + 0.4 * progress.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      accessibilityRole="checkbox"
      aria-checked={checked}
      hitSlop={{ top: 4, bottom: 4 }}>
      <View style={styles.check}>
        <Icon name="checkOff" width={23} style={StyleSheet.absoluteFill} />
        <Animated.View collapsable={false} style={[StyleSheet.absoluteFill, styles.checkOn, fillStyle]}>
          <Icon name="checkOn" width={23} style={StyleSheet.absoluteFill} />
          <Icon name="tick" width={12} />
        </Animated.View>
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // AutoLayoyted: title Inter ExtraBold 29.8 (ink 19.7 × 89.8), subtitle Inter 17.2 #999 (cap top 137.7), 14 rows
  // 36 apart with 23px checks from y 195, labels Inter Medium 17 from x 55.4, Continue 352 wide at y 739.
  title: { fontSize: 29.8, lineHeight: 33, marginLeft: 1.5 },
  subtitle: { marginTop: -20.44, fontFamily: INTER_FAMILIES['400'], fontSize: 17.2, lineHeight: 22, color: '#999999' },
  list: { flex: 1, marginTop: 33.54 },
  listContent: { paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13.5, height: 36 },
  check: { width: 23, height: 23 },
  checkOn: { alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: INTER_FAMILIES['500'], fontSize: 17, lineHeight: 23, letterSpacing: 0.17, color: colors.text },
  footer: { marginHorizontal: 1 },
});
