import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PostActions } from '@/components/post-actions';
import { PressableScale } from '@/components/pressable-scale';
import { useFeed } from '@/state/feed';
import { useSession } from '@/state/session';
import { colors, motion } from '@/theme';
import { AnimatedText, INTER_FAMILIES, Text, TextInput } from '@/components/text';
import { back } from '@/lib/nav';

// AutoLayouted-16 … -19 (BG(2)), y − 47 under the status bar. Header: chevron at (15.5, 55.5), "New Article" Inter
// Bold 14.2 centred (ink 61.7), ⋯ three 3.3 dots from x 354.8 at 66.3, a 1px #E9E9E9 line at 92. Below it, fixed
// places: the title (Inter Bold 31.9, -0.03em, lines 42 apart, #0F1419) with its ink from 146.5, the subtitle (Inter
// 15.6 / 26, #0F1419) from 298 and the picture 360×272 (r 1) at (15, 402) since TH(2) dropped the page/word count;
// Post 360×38 (r 7) 15 above the home indicator / 10 above the keyboard.
const LINE_Y = 93; // under the header line
const KEYBOARD_GAP = 10;

export default function NewArticle() {
  const insets = useSafeAreaInsets();
  const { draft, updateDraft, publish } = useFeed();
  const { user } = useSession();
  const [menu, setMenu] = useState(false);
  const canPost = !!draft.coverUri && draft.label.trim().length > 0;

  const active = useSharedValue(canPost ? 1 : 0);
  useEffect(() => {
    active.set(withTiming(canPost ? 1 : 0, { duration: motion.base }));
  }, [canPost, active]);
  const buttonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(active.get(), [0, 1], ['#DDDDDD', '#000000']),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(active.get(), [0, 1], ['#8C8C8C', '#FFFFFF']),
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

  const bottomPad = insets.bottom + 16;
  const at = (y: number) => y - LINE_Y; // design y → offset under the header line

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => back()} hitSlop={12} scaleTo={0.9} accessibilityLabel="Back" style={styles.back}>
          <Icon name="articleBack" width={15} height={26} />
        </PressableScale>
        <Text style={styles.title}>New Article</Text>
        {/* Not designed: ⋯ offers sharing the draft text or discarding it. */}
        <PressableScale onPress={() => setMenu(true)} hitSlop={12} accessibilityLabel="More" style={styles.menu}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </PressableScale>
      </View>

      <View style={styles.body}>
        <TextInput
          autoFocus
          value={draft.label}
          onChangeText={(label) => updateDraft({ label: label.replace(/\n/g, ' ') })}
          placeholder="The title..."
          placeholderTextColor="#0F1419"
          multiline
          maxLength={80}
          submitBehavior="blurAndSubmit"
          style={[styles.titleInput, { top: at(137.1) }]}
          accessibilityLabel="Title"
        />
        <TextInput
          value={draft.subtitle}
          onChangeText={(subtitle) => updateDraft({ subtitle: subtitle.replace(/\n/g, ' ') })}
          placeholder="Subtitle..."
          placeholderTextColor={colors.text}
          multiline
          maxLength={140}
          submitBehavior="blurAndSubmit"
          style={[styles.subtitleInput, { top: at(290.7) }]}
          accessibilityLabel="Subtitle"
        />
        <View style={[styles.picture, { top: at(402) }]}>
          {draft.coverUri ? <Image source={{ uri: draft.coverUri }} style={styles.fill} contentFit="cover" transition={250} /> : null}
        </View>
      </View>

      <KeyboardStickyView offset={{ closed: 0, opened: bottomPad - KEYBOARD_GAP }}>
        <View style={[styles.footer, { paddingBottom: bottomPad }]}>
          <PressableScale haptic disabled={!canPost} scaleTo={0.97} onPress={onPost} accessibilityRole="button" accessibilityState={{ disabled: !canPost }}>
            <Animated.View collapsable={false} style={[styles.post, buttonStyle]}>
              <AnimatedText style={[styles.postText, labelStyle]}>Post</AnimatedText>
            </Animated.View>
          </PressableScale>
        </View>
      </KeyboardStickyView>

      <PostActions
        visible={menu}
        onClose={() => setMenu(false)}
        actions={[
          { label: 'Share text', onPress: () => Share.share({ message: [draft.label, draft.body].filter(Boolean).join('\n\n') }).catch(() => {}) },
          {
            label: 'Discard draft',
            destructive: true,
            onPress: () =>
              Alert.alert('Discard this draft?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => { updateDraft({ label: '', subtitle: '', body: '', coverUri: null }); router.dismissTo('/'); } },
              ]),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: 46, borderBottomWidth: 1, borderBottomColor: '#E9E9E9' },
  back: { position: 'absolute', left: 15, top: 8 },
  title: { position: 'absolute', left: 0, right: 0, top: 11.6, textAlign: 'center', fontFamily: INTER_FAMILIES['700'], fontSize: 14.2, lineHeight: 17, color: colors.text, transform: [{ translateX: -2 }] },
  menu: { position: 'absolute', left: 354.8, top: 19.3, flexDirection: 'row', gap: 3.7 },
  dot: { width: 3.3, height: 3.3, borderRadius: 1.65, backgroundColor: '#000000' },
  body: { flex: 1 },
  titleInput: { position: 'absolute', left: 15.6, width: 350, padding: 0, fontFamily: INTER_FAMILIES['700'], fontSize: 31.9, lineHeight: 42, letterSpacing: -0.96, color: '#0F1419' },
  subtitleInput: { position: 'absolute', left: 16.3, width: 340, padding: 0, fontFamily: INTER_FAMILIES['400'], fontSize: 15.6, lineHeight: 26, color: colors.text },
  picture: { position: 'absolute', left: 15, width: 360, height: 272, borderRadius: 1, overflow: 'hidden', backgroundColor: colors.surfaceSoft },
  fill: { width: '100%', height: '100%' },
  footer: { paddingHorizontal: 15 },
  post: { height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  postText: { fontFamily: INTER_FAMILIES['600'], fontSize: 13.6, lineHeight: 16, letterSpacing: 0.14 },
});
