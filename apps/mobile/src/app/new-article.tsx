import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { useFeed } from '@/state/feed';
import { useSession } from '@/state/session';
import { colors, motion } from '@/theme';
import { AnimatedText, Text, TextInput } from '@/components/text';

// Figma 3128:459 (empty) and 3128:560 (typing). Design status bar = 47.
const HEADER_H = 58; // hairline at y 105
const BUTTON_BOTTOM_LIFT = 7; // Post bottom at y 803 on an 844 frame with a 34px home indicator
const KEYBOARD_GAP = 10;

export default function NewArticle() {
  const insets = useSafeAreaInsets();
  const { draft, updateDraft, publish } = useFeed();
  const { user } = useSession();
  const canPost = !!draft.coverUri && draft.label.trim().length > 0;

  const active = useSharedValue(canPost ? 1 : 0);
  useEffect(() => {
    active.value = withTiming(canPost ? 1 : 0, { duration: motion.base });
  }, [canPost, active]);
  const buttonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(active.value, [0, 1], [colors.disabled, colors.primary]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(active.value, [0, 1], [colors.textMuted, '#FFFFFF']),
  }));

  const onPost = () => {
    if (!canPost || !user) return;
    publish({
      username: user.username,
      avatar: user.avatarUri ? { uri: user.avatarUri } : null,
      subtitle: user.name,
    });
    router.dismissTo('/');
  };

  const bottomPad = Math.max(insets.bottom, 12) + BUTTON_BOTTOM_LIFT;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} hitSlop={8} scaleTo={0.9} accessibilityLabel="Back" style={styles.back}>
          <Icon name="newArticleBack" width={43} />
        </PressableScale>
        <Text style={styles.title}>New article</Text>
      </View>

      <View style={styles.body}>
        {draft.coverUri ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.coverCard}>
            <Image source={{ uri: draft.coverUri }} style={styles.fill} contentFit="cover" transition={150} />
          </Animated.View>
        ) : null}
        <TextInput
          autoFocus
          value={draft.label}
          onChangeText={(label) => updateDraft({ label })}
          placeholder="Label your article..."
          placeholderTextColor="#737373"
          multiline
          maxLength={180}
          selectionColor={colors.primary}
          style={styles.label}
          accessibilityLabel="Article label"
        />
      </View>

      <KeyboardStickyView offset={{ closed: 0, opened: bottomPad - KEYBOARD_GAP }}>
        <View style={[styles.footer, { paddingBottom: bottomPad }]}>
          <PressableScale haptic disabled={!canPost} scaleTo={0.97} onPress={onPost} accessibilityRole="button" accessibilityState={{ disabled: !canPost }}>
            <Animated.View style={[styles.post, buttonStyle]}>
              <AnimatedText style={[styles.postText, labelStyle]}>Post</AnimatedText>
            </Animated.View>
          </PressableScale>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    height: HEADER_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  back: { position: 'absolute', left: 12, top: 6 },
  title: { fontSize: 16, lineHeight: 16, letterSpacing: -0.16, fontWeight: '700', color: colors.text, marginTop: -4 },
  body: { flex: 1, paddingTop: 13 },
  coverCard: { alignSelf: 'center', width: 280, height: 162, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surfaceSoft },
  fill: { width: '100%', height: '100%' },
  label: {
    marginTop: 17,
    marginHorizontal: 22,
    fontSize: 13.25,
    lineHeight: 16,
    color: colors.text,
    padding: 0,
  },
  footer: { paddingHorizontal: 21 },
  post: { height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  postText: { fontSize: 13.5, lineHeight: 16, letterSpacing: 0.27, fontWeight: '600' },
});
