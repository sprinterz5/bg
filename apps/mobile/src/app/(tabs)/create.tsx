import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { pickCover } from '@/lib/pick-cover';
import { useFeed } from '@/state/feed';
import { colors, fonts } from '@/theme';
import { Text, TextInput } from '@/components/text';
import { push } from '@/lib/nav';

// AutoLayouted 20 (empty) and 3116:1136 (cover + text). Design status bar = 47.
const COVER_BOTTOM = 173; // y 220 - 47
// Black 33px circle with a white + (AutoLayouts BG(1)), centred 1.5 above the cover's bottom edge at x 23.
const PICKER = 33;

export default function CreateArticle() {
  const insets = useSafeAreaInsets();
  const { draft, updateDraft } = useFeed();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const coverH = insets.top + COVER_BOTTOM;
  const canPost = !!draft.coverUri && draft.body.trim().length > 0;
  const showBox = focused || draft.body.length > 0;

  const onPick = () => pickCover((uri) => updateDraft({ coverUri: uri }));

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.cover, { height: coverH }]}>
          {draft.coverUri ? (
            <Animated.View collapsable={false} key={draft.coverUri} entering={FadeIn.duration(300)} style={StyleSheet.absoluteFill}>
              <Image source={{ uri: draft.coverUri }} style={styles.fill} contentFit="cover" transition={200} />
            </Animated.View>
          ) : (
            <View style={[styles.placeholder, { top: insets.top + 14 }]}>
              <View style={styles.bars}>
                <View style={styles.bar} />
                <View style={styles.bar} />
                <View style={styles.bar} />
              </View>
              <Icon name="editorPlaceholder" width={108} />
            </View>
          )}
        </View>

        <PressableScale
          haptic
          scaleTo={0.9}
          onPress={onPick}
          accessibilityLabel="Choose a cover"
          style={[styles.pickerBtn, { top: coverH - 1.5 - PICKER / 2 }]}>
          <Icon name="editorPickerPlus" width={PICKER} height={PICKER} />
        </PressableScale>

        <View style={[styles.textBox, showBox && styles.textBoxActive]}>
          <TextInput
            ref={inputRef}
            value={draft.body}
            onChangeText={(body) => updateDraft({ body })}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Start writing..."
            placeholderTextColor="#999999"
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            selectionColor={colors.primary}
            style={styles.input}
            accessibilityLabel="Article text"
          />
        </View>
      </KeyboardAwareScrollView>

      <PressableScale
        haptic
        disabled={!canPost}
        onPress={() => push('/new-article')}
        scaleTo={0.94}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canPost }}
        style={[styles.post, { top: insets.top + 4.5 }]}>
        <Text style={[styles.postText, canPost && styles.postTextActive]}>Post</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },
  cover: { width: '100%', backgroundColor: '#CDCDCD', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  placeholder: { position: 'absolute', left: 61, flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  bars: { paddingTop: 37, gap: 13 },
  bar: { width: 125, height: 11, borderRadius: 5, backgroundColor: '#B7B7B7' },
  pickerBtn: { position: 'absolute', left: 23, width: PICKER, height: PICKER },
  textBox: {
    marginTop: 34,
    marginLeft: 32,
    marginRight: 35,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'transparent',
    borderRadius: 2,
  },
  textBoxActive: { borderColor: '#D9D9D9' },
  input: {
    fontFamily: fonts.reading,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.04,
    color: '#000000',
    padding: 0,
    minHeight: 46,
  },
  post: {
    position: 'absolute',
    right: 18.5,
    width: 76,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 0.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  postText: { fontSize: 15, fontWeight: '700', color: '#999999' },
  postTextActive: { color: colors.text },
});
