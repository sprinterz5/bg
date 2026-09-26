import { useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Text, TextInput } from '@/components/text';
import { chatSocket, fetchMessages, markRead, sendMessage, type ChatMessage } from '@/lib/chat';
import { back, push } from '@/lib/nav';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// No Figma frame for a conversation yet: plain bubbles + input in the app's palette, to be replaced by the design.
const GRAY = '#EFF3F4';

export default function Conversation() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { id, username } = useLocalSearchParams<{ id: string; username: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]); // newest first (inverted list)
  const [cursor, setCursor] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const add = (m: ChatMessage) => setMessages((list) => (list.some((x) => x.id === m.id) ? list : [m, ...list]));

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchMessages(id)
      .then((page) => {
        if (!alive) return;
        setMessages(page.data);
        setCursor(page.nextCursor);
      })
      .catch(() => {});
    markRead(id);

    const socket = chatSocket();
    // A chat created after the socket connected is not in its rooms yet.
    const join = () => socket.emit('conversation:join', { conversationId: id });
    join();
    socket.on('connect', join);
    const onNew = (m: ChatMessage) => {
      if (m.conversationId !== id) return;
      add(m);
      markRead(id);
    };
    socket.on('message:new', onNew);
    return () => {
      alive = false;
      socket.off('connect', join);
      socket.off('message:new', onNew);
    };
  }, [id]);

  const loadOlder = () => {
    if (!id || !cursor) return;
    const c = cursor;
    setCursor(null);
    fetchMessages(id, c)
      .then((page) => {
        setMessages((list) => [...list, ...page.data.filter((m) => !list.some((x) => x.id === m.id))]);
        setCursor(page.nextCursor);
      })
      .catch(() => setCursor(c));
  };

  const send = () => {
    const body = text.trim();
    if (!id || !body || sending) return;
    setSending(true);
    setText('');
    sendMessage(id, body)
      .then(add)
      .catch(() => setText(body))
      .finally(() => setSending(false));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => back()} hitSlop={12} scaleTo={0.85} accessibilityLabel="Back" style={styles.back}>
          <Icon name="searchBack" width={12} height={20} />
        </PressableScale>
        <PressableScale
          onPress={() => username && push(`/user/${encodeURIComponent(username)}` as Href)}
          scaleTo={0.97}
          style={styles.titleWrap}
          accessibilityRole="button">
          <Text style={styles.title} numberOfLines={1}>
            {username}
          </Text>
        </PressableScale>
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.body}>
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => {
            const mine = item.senderId === user?.id;
            // Tighter spacing inside a run of messages from the same sender (list is newest first).
            const sameAsOlder = messages[index + 1]?.senderId === item.senderId;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs, { marginTop: sameAsOlder ? 3 : 12 }]}>
                <Text style={[styles.bubbleText, mine && styles.mineText]}>{item.body}</Text>
              </View>
            );
          }}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor="#536471"
            multiline
            selectionColor={colors.primary}
            cursorColor={colors.text}
            style={styles.input}
            accessibilityLabel="Message"
          />
          <PressableScale haptic disabled={!text.trim() || sending} onPress={send} scaleTo={0.9} hitSlop={8} accessibilityRole="button" accessibilityLabel="Send">
            <Text style={[styles.send, !text.trim() && styles.sendOff]}>Send</Text>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY,
  },
  back: { width: 12, height: 20 },
  titleWrap: { marginLeft: 28, marginRight: 24, flex: 1 },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '700', color: colors.text },
  body: { flex: 1 },
  list: { paddingHorizontal: 11, paddingVertical: 12 },
  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: GRAY },
  bubbleText: { fontSize: 15, lineHeight: 20, color: colors.text },
  mineText: { color: '#FFFFFF' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 11,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: GRAY,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 39,
    maxHeight: 120,
    borderRadius: 20,
    backgroundColor: GRAY,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    lineHeight: 19,
    color: colors.text,
  },
  send: { fontSize: 16, lineHeight: 39, fontWeight: '600', color: colors.primary },
  sendOff: { opacity: 0.4 },
});
