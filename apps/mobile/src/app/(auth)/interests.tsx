import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
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
import { AnimatedText, Text } from '@/components/text';

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
      shake.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 70 }),
        withTiming(-3, { duration: 60 }),
        withTiming(0, { duration: 50 }),
      );
      return;
    }
    Haptics.selectionAsync();
    setSelected([...current, slug]);
  };

  const subtitleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const next = () => {
    if (!valid) return;
    updateDraft({ interests: selected });
    router.push('/ready');
  };

  return (
    <StepScreen
      title="Pick your interests"
      showBack={false}
      gutter={18}
      footerLift={22}
      avoidKeyboard={false}
      footer={<PrimaryButton title="Continue" enabled={valid} onPress={next} />}>
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
    progress.value = withSpring(checked ? 1 : 0, { damping: 14, stiffness: 260 });
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
        <Icon name="checkOff" width={24} style={StyleSheet.absoluteFill} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.checkOn, fillStyle]}>
          <Icon name="checkOn" width={24} style={StyleSheet.absoluteFill} />
          <Icon name="tick" width={12} />
        </Animated.View>
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: -12, fontSize: 17.5, lineHeight: 22, color: colors.textMuted, letterSpacing: -0.35 },
  list: { flex: 1, marginTop: 27 },
  listContent: { paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 29 },
  check: { width: 24, height: 24 },
  checkOn: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 17.5, lineHeight: 23, fontWeight: '500', color: colors.text, letterSpacing: 0.1 },
});
