import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, View } from 'react-native';
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

      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Write a caption..."
        placeholderTextColor="#999999"
        multiline
        maxLength={CAPTION_MAX}
        cursorColor={colors.text}
        scrollEnabled={false}
        style={styles.caption}
        accessibilityLabel="Caption"
      />

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
    </Pressable>
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
  caption: {
    marginTop: 21.5,
    marginHorizontal: 19.65,
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
