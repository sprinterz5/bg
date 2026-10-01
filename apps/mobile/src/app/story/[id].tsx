import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Image as RNImage, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthorAvatar } from '@/components/author-row';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Text, TextInput } from '@/components/text';
import { back, replace } from '@/lib/nav';
import { HOME_STORIES } from '@/mock/data';

// Frame 1049 story viewer (design status bar 47, home indicator 34). Photo centred on design y 385,
// up to 540 tall; author row 93 and caption 46 above the bottom bar; bar 51 + indicator, #0D1015.
const BAR = '#0D1015';
const MUTED = '#8E8E93';
const MAX_H = 540;

export default function StoryViewer() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const index = Math.max(0, HOME_STORIES.findIndex((s) => s.id === id));
  const story = HOME_STORIES[index];
  const [expanded, setExpanded] = useState(false);

  const src = RNImage.resolveAssetSource(story.image as number);
  const photoH = Math.min(MAX_H, src ? (width * src.height) / src.width : MAX_H);
  const photoTop = insets.top + (385 - 47) - photoH / 2;
  const barH = 51 + Math.max(insets.bottom, 12);

  // Tap the right side for the next story, the left side for the previous one; past the last one closes.
  const go = (step: number) => {
    const next = HOME_STORIES[index + step];
    if (next) replace(`/story/${next.id}` as Href);
    else back();
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.statusBar, { height: insets.top }]} />
      <Image source={story.image} style={{ position: 'absolute', top: photoTop, width, height: photoH }} contentFit="cover" transition={150} />
      <Pressable style={[styles.half, { left: 0, width: width / 2, height }]} onPress={() => go(-1)} accessibilityLabel="Previous story" />
      <Pressable style={[styles.half, { left: width / 2, width: width / 2, height }]} onPress={() => go(1)} accessibilityLabel="Next story" />

      <PressableScale onPress={() => back()} hitSlop={14} accessibilityLabel="Close" style={[styles.back, { top: insets.top + 18 }]}>
        <Icon name="storyBack" width={15.7} height={27.06} />
      </PressableScale>

      <View style={[styles.info, { bottom: barH }]} pointerEvents="box-none">
        <View style={styles.author}>
          <AuthorAvatar author={story.author} size={28} />
          <View style={styles.names}>
            <Text style={styles.name}>{story.author.username}</Text>
            <Text style={styles.time}>{story.timeAgo}</Text>
          </View>
        </View>
        <Pressable onPress={() => setExpanded((v) => !v)}>
          <Text style={styles.caption} numberOfLines={expanded ? undefined : 2}>
            {story.caption}
          </Text>
        </Pressable>
      </View>

      <KeyboardStickyView style={[styles.bar, { height: barH }]} offset={{ closed: 0, opened: barH - 63 }}>
        <View style={styles.pill}>
          <TextInput placeholder="Send message..." placeholderTextColor="#FFFFFF" style={styles.input} selectionColor="#FFFFFF" cursorColor="#FFFFFF" />
        </View>
        <PressableScale haptic hitSlop={10} accessibilityLabel="Like story" style={styles.heart}>
          <Icon name="storyHeart" width={27} height={24} />
        </PressableScale>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  statusBar: { backgroundColor: BAR },
  half: { position: 'absolute', top: 0 },
  back: { position: 'absolute', left: 15.775 },
  info: { position: 'absolute', left: 14, right: 54 },
  // avatar 28; name 14/600 baseline +12, time 12 baseline +25.2; caption line 18.9 under the avatar
  author: { flexDirection: 'row', height: 28 },
  names: { marginLeft: 12.5, marginTop: -1.5 },
  name: { fontSize: 14, lineHeight: 17, fontWeight: '600', color: '#FFFFFF' },
  time: { marginTop: -1.7, marginLeft: 1.3, fontSize: 12, lineHeight: 14, color: MUTED },
  caption: { marginTop: 18.9, marginBottom: 14.1, fontSize: 12.65, lineHeight: 15.65, color: '#FFFFFF' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: BAR },
  // 286.5x41.5 pill with a 0.5 #A6A6A6 stroke at x 14.75, 11.75 under the bar top; text at x 37.2
  pill: {
    position: 'absolute',
    left: 14.5,
    top: 11.5,
    width: 287,
    height: 42,
    borderRadius: 21,
    borderWidth: 0.5,
    borderColor: '#A6A6A6',
    justifyContent: 'center',
    paddingLeft: 22.2,
    paddingRight: 16,
  },
  input: { fontSize: 13, color: '#FFFFFF', padding: 0 },
  heart: { position: 'absolute', left: 329, top: 19.75 },
});
