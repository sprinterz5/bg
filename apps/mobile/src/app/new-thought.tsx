import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthorAvatar } from '@/components/author-row';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { INTER_FAMILIES, Text, TextInput } from '@/components/text';
import { THOUGHT_MAX, useFeed } from '@/state/feed';
import { useSession } from '@/state/session';

// "New thought" (AutoLayouts TH): a short text post without a picture. Title, close, the author with a free field
// ("Anything new?"), who may see it (Everyone / Followers / Following each other) and Post over the keyboard.
// Not designed: the audience is only chosen here for now, the server shows every thought to everyone.
const AUDIENCES = ['Everyone', 'Followers', 'Following each other'] as const;

export default function NewThought() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { publishThought } = useFeed();
  const [text, setText] = useState('');
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>('Everyone');
  const [sending, setSending] = useState(false);
  const canPost = text.trim().length > 0 && !sending;

  const author = {
    username: user?.username ?? '',
    name: user?.name,
    avatar: user?.avatarUri ? { uri: user.avatarUri } : null,
    subtitle: '',
  };

  const post = async () => {
    if (!canPost || !user) return;
    setSending(true);
    try {
      await publishThought(text, author);
      router.back();
    } catch {
      setSending(false);
      Alert.alert("Couldn't post", 'Check the connection and try again.');
    }
  };

  return (
    <View style={[styles.root, { paddingTop: 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>New thought</Text>
        <PressableScale onPress={() => router.back()} hitSlop={12} scaleTo={0.9} accessibilityLabel="Close" style={styles.close}>
          <Icon name="readerClose2" width={31} />
        </PressableScale>
      </View>
      <View style={styles.line} />

      <View style={styles.compose}>
        <View style={styles.avatar}>
          <AuthorAvatar author={author} size={41} />
        </View>
        <View style={styles.column}>
          <Text style={styles.name}>{user?.name ?? user?.username ?? ''}</Text>
          <TextInput
            autoFocus
            multiline
            value={text}
            onChangeText={(t) => setText(t.slice(0, THOUGHT_MAX))}
            placeholder="Anything new?"
            placeholderTextColor="#999999"
            selectionColor="#000000"
            style={styles.input}
            accessibilityLabel="Your thought"
          />
        </View>
      </View>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }} style={styles.footerWrap}>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.chips}>
            {AUDIENCES.map((a) => (
              <PressableScale key={a} onPress={() => setAudience(a)} accessibilityRole="button" accessibilityState={{ selected: a === audience }} style={[styles.chip, a === audience && styles.chipOn]}>
                <Text style={[styles.chipText, a === audience && styles.chipTextOn]}>{a}</Text>
              </PressableScale>
            ))}
          </View>
          <View style={styles.postRow}>
            <Text style={styles.count}>{text.length > THOUGHT_MAX - 60 ? `${text.length}/${THOUGHT_MAX}` : ' '}</Text>
            <PressableScale haptic disabled={!canPost} scaleTo={0.96} onPress={post} accessibilityRole="button" accessibilityState={{ disabled: !canPost }} style={[styles.post, canPost && styles.postOn]}>
              <Text style={styles.postText}>Post</Text>
            </PressableScale>
          </View>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: INTER_FAMILIES['600'], fontSize: 16, lineHeight: 20, color: '#0F1419' },
  close: { position: 'absolute', right: 14, top: 12 },
  line: { height: StyleSheet.hairlineWidth, backgroundColor: '#E9E9E9' },
  compose: { flexDirection: 'row', paddingTop: 14, paddingHorizontal: 9 },
  avatar: { width: 41 },
  column: { flex: 1, marginLeft: 11 },
  name: { fontFamily: INTER_FAMILIES['600'], fontSize: 15, lineHeight: 19, color: '#0F1419' },
  input: { padding: 0, marginTop: 3, minHeight: 120, fontFamily: INTER_FAMILIES['400'], fontSize: 15.5, lineHeight: 22, color: '#0F1419', textAlignVertical: 'top' },
  footerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  footer: { paddingTop: 10, paddingHorizontal: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  chip: { height: 30, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderColor: '#DDDDDD', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: '#000000', borderColor: '#000000' },
  chipText: { fontFamily: INTER_FAMILIES['500'], fontSize: 12, lineHeight: 16, color: '#999999' },
  chipTextOn: { color: '#FFFFFF' },
  postRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontFamily: INTER_FAMILIES['400'], fontSize: 12, lineHeight: 16, color: '#999999' },
  post: { width: 68, height: 44, borderRadius: 22, backgroundColor: '#999999', alignItems: 'center', justifyContent: 'center' },
  postOn: { backgroundColor: '#000000' },
  postText: { fontFamily: INTER_FAMILIES['600'], fontSize: 14, lineHeight: 18, color: '#FFFFFF' },
});
