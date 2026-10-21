import { Image } from 'expo-image';
import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/glass';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { pickCover } from '@/lib/pick-cover';
import { useFeed } from '@/state/feed';
import { colors, fonts } from '@/theme';
import { TextInput } from '@/components/text';
import { push } from '@/lib/nav';

// AutoLayouted-28 (empty) and -27 (typing), TH(2). Design status bar = 47. The cover runs to y 218; over it glass
// circles 36 (white 70% + blur, 1 white ring) at y 52: gallery at x 287, next → at 335 (#999 until there is a cover
// and text), and while writing undo / redo at x 20 and 68. The text box (0.3 #DDDDDD while writing) from (32.6, 244.2).
const COVER_BOTTOM = 171; // y 218 - 47
const HISTORY = 100;

export default function CreateArticle() {
  const insets = useSafeAreaInsets();
  const { draft, updateDraft } = useFeed();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const coverH = insets.top + COVER_BOTTOM;
  const canPost = !!draft.coverUri && draft.body.trim().length > 0;
  const showBox = focused || draft.body.length > 0;

  // undo / redo: every edit is a step (kept per visit of the screen)
  const [hist, setHist] = useState({ list: [draft.body], i: 0 });
  const edit = (body: string) => {
    setHist((h) => {
      const list = [...h.list.slice(Math.max(0, h.i + 1 - HISTORY), h.i + 1), body];
      return { list, i: list.length - 1 };
    });
    updateDraft({ body });
  };
  const step = (d: number) => {
    const i = hist.i + d;
    if (i < 0 || i >= hist.list.length) return;
    setHist({ ...hist, i });
    updateDraft({ body: hist.list[i] });
  };
  const canUndo = hist.i > 0;
  const canRedo = hist.i < hist.list.length - 1;

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

        <View style={[styles.textBox, showBox && styles.textBoxActive]}>
          <TextInput
            ref={inputRef}
            value={draft.body}
            onChangeText={edit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Just do it..."
            placeholderTextColor="#999999"
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            style={styles.input}
            accessibilityLabel="Article text"
          />
        </View>
      </KeyboardAwareScrollView>

      {showBox ? (
        <Animated.View collapsable={false} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[styles.left, { top: insets.top + 4.5 }]}>
          <GlassButton onPress={() => step(-1)} disabled={!canUndo} label="Undo">
            <Icon name="editorUndo" width={18} height={18} style={!canUndo && styles.off} />
          </GlassButton>
          <GlassButton onPress={() => step(1)} disabled={!canRedo} label="Redo">
            <Icon name="editorRedo" width={18} height={18} style={!canRedo && styles.off} />
          </GlassButton>
        </Animated.View>
      ) : null}
      <View style={[styles.right, { top: insets.top + 4.5 }]}>
        <GlassButton onPress={onPick} label="Choose a cover">
          <Icon name="editorGallery" width={23.6} height={23.6} />
        </GlassButton>
        <GlassButton onPress={() => push('/new-article')} disabled={!canPost} label="Next">
          <Icon name="editorNext" width={18.2} height={16.2} tintColor={canPost ? '#000000' : '#999999'} />
        </GlassButton>
      </View>
    </View>
  );
}

function GlassButton({ onPress, disabled, label, children }: { onPress: () => void; disabled?: boolean; label: string; children: ReactNode }) {
  return (
    <PressableScale haptic disabled={disabled} onPress={onPress} scaleTo={0.9} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}>
      <Glass radius={18.5} style={styles.glass}>
        {children}
      </Glass>
    </PressableScale>
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
  textBox: {
    marginTop: 26.2,
    marginLeft: 32.6,
    marginRight: 35.7,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderWidth: 0.3,
    borderColor: 'transparent',
  },
  textBoxActive: { borderColor: '#DDDDDD' },
  input: {
    fontFamily: fonts.reading,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.04,
    color: colors.text,
    padding: 0,
    minHeight: 46,
  },
  left: { position: 'absolute', left: 19.5, flexDirection: 'row', gap: 11 },
  right: { position: 'absolute', right: 18.5, flexDirection: 'row', gap: 11 },
  glass: { width: 37, height: 37, borderWidth: 1, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
});
