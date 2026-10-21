import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { INTER_FAMILIES, Text, TextInput } from '@/components/text';
import { api } from '@/lib/api';
import { back, backWhenReady } from '@/lib/nav';
import { uploadImage } from '@/lib/media';
import { colors } from '@/theme';

// AutoLayouted-34 / -35, NOLayout-1, NOlayout: back · "New story", the photo fitted into 240x205 (radius 10) under
// the rule, "Write a caption..." 21.5 below it, Share pinned to the bottom (grey while the story is being sent).
const BOX_W = 240;
const BOX_H = 205;
const CAPTION_MAX = 300;

export default function NewStory() {
  const insets = useSafeAreaInsets();
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const [size, setSize] = useState({ width: BOX_W, height: 176 });
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);

  const share = async () => {
    if (!uri || sending) return;
    setSending(true);
    Keyboard.dismiss();
    try {
      const asset = await uploadImage(uri, 'STORY_IMAGE');
      await api('/stories', {
        body: { mediaUrl: asset.url, mediaMimeType: 'image/jpeg', ...(caption.trim() ? { caption: caption.trim() } : {}) },
        auth: true,
        idempotent: true,
      });
      backWhenReady();
    } catch {
      setSending(false);
      Alert.alert("Couldn't share the story", 'Check the connection and try again.');
    }
  };

  return (
    <Pressable style={[styles.root, { paddingTop: insets.top }]} onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.header}>
        <PressableScale onPress={() => back()} hitSlop={8} scaleTo={0.88} accessibilityLabel="Back" style={styles.back}>
          <Icon name="searchBack" width={11} height={20} />
        </PressableScale>
        <Text style={styles.title}>New story</Text>
      </View>

      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.photo, size]}
          contentFit="cover"
          onLoad={(e) => {
            const { width, height } = e.source;
            if (!width || !height) return;
            const k = Math.min(BOX_W / width, BOX_H / height);
            setSize({ width: Math.round(width * k), height: Math.round(height * k) });
          }}
        />
      ) : null}

      {/* AutoLayouted-43 (TH(2)): the caption is written in a sheet that drops from the top */}
      <Pressable onPress={() => setEditing(true)} style={styles.captionRow} accessibilityRole="button" accessibilityLabel="Caption">
        <Text style={[styles.caption, !caption && styles.placeholder]} numberOfLines={6}>
          {caption || 'Write a caption...'}
        </Text>
      </Pressable>

      {/* TH(2): a hairline 23 above Share */}
      <View style={[styles.line, { bottom: insets.bottom + 67.5 }]} />
      <PressableScale
        haptic
        onPress={share}
        disabled={!uri || sending}
        scaleTo={0.97}
        style={[styles.share, { bottom: insets.bottom + 7 }, (!uri || sending) && styles.shareOff]}
        accessibilityRole="button"
        accessibilityLabel="Share">
        <Text style={styles.shareText}>Share</Text>
      </PressableScale>

      {editing ? <CaptionSheet initial={caption} top={insets.top} onDone={(c) => { setCaption(c); setEditing(false); }} /> : null}
    </Pressable>
  );
}

// Caption sheet (AutoLayouted-43): white from the top to y 251 over a 45% black veil; "Caption" Inter ExtraBold 15.4
// centred (ink 59.4), a black ✓ circle 41 centred on (346.5, 63.5), a hairline at 97, the text (as on the screen) from
// (18.8, 123.3).
function CaptionSheet({ initial, top, onDone }: { initial: string; top: number; onDone: (caption: string) => void }) {
  const [text, setText] = useState(initial);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View collapsable={false} entering={FadeIn.duration(200)} style={styles.veil}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => onDone(text)} accessibilityLabel="Done" />
      </Animated.View>
      <Animated.View collapsable={false} entering={SlideInUp.duration(280).easing(Easing.out(Easing.cubic))} style={[styles.sheet, { height: top + 204 }]}>
        <Text style={[styles.sheetTitle, { top: top + 9.6 }]}>Caption</Text>
        <PressableScale haptic onPress={() => onDone(text)} scaleTo={0.9} accessibilityRole="button" accessibilityLabel="Done" style={[styles.done, { top: top - 4 }]}>
          <Icon name="captionDone" width={19} height={14} />
        </PressableScale>
        <View style={[styles.sheetLine, { top: top + 50 }]} />
        <TextInput
          autoFocus
          value={text}
          onChangeText={setText}
          placeholder="Write a caption..."
          placeholderTextColor="#999999"
          multiline
          maxLength={CAPTION_MAX}
          cursorColor={colors.text}
          style={[styles.caption, styles.sheetInput, { top: top + 72.6 }]}
          accessibilityLabel="Caption"
        />
      </Animated.View>
    </View>
  );
}

// Design y − 47: back circle 43 at (13, 5), "New story" Inter 15.5 bold (box 18.9), rule at 58; photo from 70
// (centred on x 194 in the design, centred here); caption Inter 13.2 / 17.75 at x 19.65; Share 348x38 at x 21, r 7.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: 58.5, borderBottomWidth: 0.5, borderBottomColor: '#E9E9E9' },
  back: { position: 'absolute', left: 13, top: 5, width: 43, height: 43, borderRadius: 21.5, backgroundColor: '#F2F2F2', paddingLeft: 14, paddingTop: 12 },
  title: { position: 'absolute', left: 0, right: 0, top: 18.87, textAlign: 'center', fontFamily: INTER_FAMILIES['700'], fontSize: 15.5, lineHeight: 19, color: colors.text },
  photo: { alignSelf: 'center', marginTop: 11.5, borderRadius: 10 },
  captionRow: { marginTop: 21.5, marginHorizontal: 19.65 },
  placeholder: { color: '#999999' },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: '#FFFFFF' },
  sheetTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: INTER_FAMILIES['800'], fontSize: 15.4, lineHeight: 19, color: colors.text },
  done: { position: 'absolute', left: 326, width: 41, height: 41, borderRadius: 20.5, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  sheetLine: { position: 'absolute', left: 0, right: 0, height: 0.5, backgroundColor: '#E9E9E9' },
  sheetInput: { position: 'absolute', left: 18.3, right: 19, bottom: 12 },
  caption: {
    padding: 0,
    textAlignVertical: 'top',
    fontFamily: INTER_FAMILIES['400'],
    fontSize: 13.2,
    lineHeight: 17.75,
    color: colors.text,
  },
  share: { position: 'absolute', left: 21, right: 21, height: 38, borderRadius: 7, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  shareOff: { backgroundColor: '#B3B3B3' },
  line: { position: 'absolute', left: 0, right: 0, height: 0.5, backgroundColor: '#E9E9E9' },
  shareText: { fontFamily: INTER_FAMILIES['600'], fontSize: 13.2, lineHeight: 17, color: '#FFFFFF' },
});
