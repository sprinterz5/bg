import type { ApiProfile } from '@api/api';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { INTER_FAMILIES, Text, TextInput } from '@/components/text';
import { chatSocket, fetchMessages, markRead, sendMessage, type ChatMessage } from '@/lib/chat';
import { back, openProfile } from '@/lib/nav';
import { fetchProfile } from '@/lib/users';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// Conversation (AutoLayouts export: the chat frame and the three "sending a message" frames). Header: back, avatar,
// name and username, call and video. The oldest end starts with the other person's card; messages are grey (theirs)
// and blue (mine) bubbles with a centred time above each run that starts more than an hour after the previous one.
// The field is a grey pill with the photo button; the white send pill shows up once there is text, and the pill grows
// up to six lines.
const SUBTLE = '#788690';
const BUBBLE = '#F7F7F7';
const RUN_GAP = 60 * 60 * 1000;
const LINE = 19;
const MAX_LINES = 6;

export default function Conversation() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { id, username } = useLocalSearchParams<{ id: string; username: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]); // newest first (inverted list)
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [other, setOther] = useState<ApiProfile | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [tall, setTall] = useState(false);

  const add = (m: ChatMessage) => setMessages((list) => (list.some((x) => x.id === m.id) ? list : [m, ...list]));

  useEffect(() => {
    if (!username) return;
    let alive = true;
    fetchProfile(username)
      .then((p) => alive && setOther(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [username]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchMessages(id)
      .then((page) => {
        if (!alive) return;
        setMessages(page.data);
        setCursor(page.nextCursor);
      })
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
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

  const showProfile = () => username && openProfile(username, true);
  // No calls or photo messages yet.
  const soon = (what: string) => Alert.alert(`${what} aren't available yet`, 'They are coming in a later version.');

  // The field sits 13 above the home indicator, 8 above the keyboard.
  const { progress } = useReanimatedKeyboardAnimation();
  const closedPad = insets.bottom + 13;
  const barPad = useAnimatedStyle(() => ({ paddingBottom: interpolate(progress.get(), [0, 1], [closedPad, 8]) }));

  const name = other?.displayName || username || '';
  const avatar = other?.avatarUrl ? { uri: other.avatarUrl } : null;
  const hasText = text.trim().length > 0;

  const card = (
    <PressableScale onPress={showProfile} scaleTo={0.98} style={styles.card} accessibilityRole="button" accessibilityLabel={`${name} profile`}>
      {avatar ? <Image source={avatar} style={styles.cardAvatar} transition={150} /> : <Icon name="avatarPlaceholder" width={105} style={styles.cardAvatar} />}
      <Text style={styles.cardName} numberOfLines={1}>
        {name}
      </Text>
      {other ? (
        <Text style={styles.cardSub} numberOfLines={1}>
          {other._count.followers} followers · {other._count.authoredArticles} articles
        </Text>
      ) : null}
    </PressableScale>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => back()} hitSlop={12} scaleTo={0.85} accessibilityLabel="Back" style={styles.back}>
          <Icon name="searchBack" width={10} height={20} />
        </PressableScale>
        <PressableScale onPress={showProfile} scaleTo={0.97} style={styles.who} accessibilityRole="button" accessibilityLabel={`${name} profile`}>
          {avatar ? <Image source={avatar} style={styles.avatar} transition={150} /> : <Icon name="avatarPlaceholder" width={37.5} style={styles.avatar} />}
          <View style={styles.names}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              {username}
            </Text>
          </View>
        </PressableScale>
        <PressableScale onPress={() => soon('Calls')} hitSlop={8} scaleTo={0.88} accessibilityLabel="Call" style={styles.call}>
          <Icon name="chatCall" width={22.42} height={22.42} />
        </PressableScale>
        <PressableScale onPress={() => soon('Video calls')} hitSlop={8} scaleTo={0.88} accessibilityLabel="Video call" style={styles.video}>
          <Icon name="chatVideo" width={25.12} height={20.5} />
        </PressableScale>
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.body}>
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          ListFooterComponent={loaded && !cursor ? card : null}
          renderItem={({ item, index }) => {
            const mine = item.senderId === user?.id;
            const older = messages[index + 1];
            const stamp = !older || new Date(item.createdAt).getTime() - new Date(older.createdAt).getTime() > RUN_GAP;
            return (
              <View>
                {stamp ? <Text style={styles.stamp}>{formatStamp(item.createdAt)}</Text> : null}
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs, !stamp && { marginTop: older?.senderId === item.senderId ? 7 : 12 }]}>
                  <Text style={[styles.bubbleText, mine && styles.mineText]}>{item.body}</Text>
                </View>
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

        <Animated.View style={[styles.bar, barPad]}>
          <View style={[styles.field, tall && styles.fieldTall]}>
            <PressableScale onPress={() => soon('Photos in chats')} scaleTo={0.9} accessibilityLabel="Send a photo" style={styles.gallery}>
              <Icon name="chatGallery" width={34} height={34} />
            </PressableScale>
            <TextInput
              value={text}
              onChangeText={setText}
              onContentSizeChange={(e) => setTall(e.nativeEvent.contentSize.height > LINE * 1.5)}
              placeholder="Message..."
              placeholderTextColor={SUBTLE}
              multiline
              selectionColor={colors.primary}
              cursorColor="#999999"
              style={[styles.input, hasText && styles.inputWithSend]}
              accessibilityLabel="Message"
            />
            {hasText ? (
              <Animated.View collapsable={false} entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={styles.sendWrap}>
                <PressableScale haptic disabled={sending} onPress={send} scaleTo={0.9} hitSlop={6} style={styles.send} accessibilityRole="button" accessibilityLabel="Send">
                  <Icon name="chatSend" width={20.82} height={18.16} />
                </PressableScale>
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** "10:34AM" today, "2d ago 12:48PM" earlier. */
function formatStamp(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'AM' : 'PM'}`;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  return days <= 0 ? time : `${days}d ago ${time}`;
}

// Design (status bar 47): header to the 0.5 hairline at y 108 — back 10x20 at (15, 69), avatar 37.5 at (43, 60),
// name Inter 15 semibold (baseline 77.6) and username 13 (baseline 91.8) at x 92, call 22.4 at (304.1, 66),
// video at (351.6, 66.25). Bubbles: Inter 15.25 / 19.5, 14 / 8.25 padding, radius 18, 9 from the edges, 7 apart within
// a run and 12 between senders; the card: avatar 105, name 16.5 semibold, line 14 grey; time 12.5 grey.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 61, borderBottomWidth: 0.5, borderBottomColor: '#EFF3F4' },
  back: { position: 'absolute', left: 15, top: 22 },
  who: { position: 'absolute', left: 43, top: 13, right: 100, flexDirection: 'row' },
  avatar: { width: 37.5, height: 37.5, borderRadius: 18.75, backgroundColor: colors.surfaceSoft },
  names: { flex: 1, marginLeft: 11.1, paddingTop: 3.13 },
  name: { fontFamily: INTER_FAMILIES['600'], fontSize: 15, lineHeight: 18, color: colors.text },
  username: { marginTop: -2.1, fontFamily: INTER_FAMILIES['400'], fontSize: 13, lineHeight: 16, color: colors.text },
  call: { position: 'absolute', left: 304.08, top: 19 },
  video: { position: 'absolute', right: 13.26, top: 19.25 },

  body: { flex: 1 },
  list: { paddingHorizontal: 9, paddingTop: 12 },
  card: { alignItems: 'center', paddingTop: 22, paddingBottom: 0 },
  cardAvatar: { width: 105, height: 105, borderRadius: 52.5, backgroundColor: colors.surfaceSoft },
  cardName: { marginTop: 8.11, maxWidth: 300, fontFamily: INTER_FAMILIES['600'], fontSize: 16.5, lineHeight: 20, color: colors.text },
  cardSub: { marginTop: 4.75, fontFamily: INTER_FAMILIES['400'], fontSize: 14, lineHeight: 17, color: SUBTLE },
  stamp: { marginTop: 24.67, marginBottom: 14.33, textAlign: 'center', fontFamily: INTER_FAMILIES['400'], fontSize: 12.5, lineHeight: 15, color: SUBTLE },
  bubble: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 8.25, borderRadius: 18 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: BUBBLE },
  bubbleText: { fontFamily: INTER_FAMILIES['400'], fontSize: 15.25, lineHeight: 19.5, color: colors.text },
  mineText: { color: '#FFFFFF' },

  // Pill x 9–381, 40 tall (radius 25 once it grows); photo button 34 at 8 / 3 in, text Inter 15.5 / 19 from x 63.5,
  // send pill 46x34 (white, radius 17) 5 from the right and 3 from the bottom.
  bar: { paddingTop: 8, paddingHorizontal: 9, backgroundColor: '#FFFFFF' },
  field: { minHeight: 40, borderRadius: 20, backgroundColor: BUBBLE, flexDirection: 'row', alignItems: 'flex-end' },
  fieldTall: { borderRadius: 25 },
  gallery: { marginLeft: 8, marginBottom: 3 },
  input: {
    flex: 1,
    maxHeight: LINE * MAX_LINES + 21,
    marginLeft: 12.5,
    marginRight: 15,
    paddingTop: 10.5,
    paddingBottom: 10.5,
    paddingHorizontal: 0,
    fontFamily: INTER_FAMILIES['400'],
    fontSize: 15.5,
    lineHeight: LINE,
    color: colors.text,
  },
  inputWithSend: { marginRight: 8 },
  sendWrap: { marginRight: 5, marginBottom: 3 },
  send: { width: 46, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
