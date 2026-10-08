import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { Text } from './text';

export type PostAction = { label: string; onPress: () => void; destructive?: boolean };

// Menu behind ⋯ / ≡ on a post (not in the design): a sheet rising from the bottom with the post's actions.
export function PostActions({ visible, actions, onClose }: { visible: boolean; actions: PostAction[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const t = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      t.set(withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }));
    } else {
      t.set(
        withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (fin) => {
          if (fin) runOnJS(setMounted)(false);
        }),
      );
    }
  }, [visible, t]);
  const backdrop = useAnimatedStyle(() => ({ opacity: t.get() * 0.35 }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - t.get()) * 360 }] }));

  const run = (a: PostAction) => {
    Haptics.selectionAsync();
    onClose();
    // After the sheet starts leaving, so a Share dialog or an alert doesn't fight with it.
    setTimeout(a.onPress, 220);
  };

  return (
    <Modal visible={mounted} transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View collapsable={false} style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View collapsable={false} style={[styles.sheet, { paddingBottom: insets.bottom + 12 }, sheet]}>
        <View style={styles.handle} />
        {actions.map((a) => (
          <Pressable key={a.label} onPress={() => run(a)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} accessibilityRole="button">
            <Text style={[styles.label, a.destructive && styles.destructive]}>{a.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#000000' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 8, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: '#FFFFFF' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 6, backgroundColor: '#E1E4E8' },
  row: { height: 52, justifyContent: 'center', paddingHorizontal: 20 },
  rowPressed: { backgroundColor: '#F4F6F8' },
  label: { fontSize: 16, lineHeight: 20, color: colors.text },
  destructive: { color: colors.danger },
});
