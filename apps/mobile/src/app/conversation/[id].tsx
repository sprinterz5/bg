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
const SUBTLE = '#999999';
const BUBBLE = '#F7F7F7';
const RUN_GAP = 60 * 60 * 1000;
const LINE = 19;
// Bubbles' text line (AutoLayouted-29: 3 lines of a message 20.2 apart).
const BUBBLE_LINE = 20.2;
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

  // The field sits 2 above the safe area (36 from the screen bottom on iPhone), 8 above the keyboard.
  const { progress } = useReanimatedKeyboardAnimation();
  const closedPad = Math.max(insets.bottom + 2, 10);
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
          {other.isFollowing && other.followsYou ? 'You both follow each other' : other.followsYou ? 'Follows you' : `${other._count.followers} followers`}
        </Text>
      ) : null}
    </PressableScale>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => back()} hitSlop={12} scaleTo={0.85} accessibilityLabel="Back" style={styles.back}>
          <Icon name="searchBack" width={13} height={26} />
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
          <View style={styles.barRow}>
          <PressableScale onPress={() => soon('Photos in chats')} scaleTo={0.9} accessibilityLabel="Attach" style={styles.plus}>
            <Icon name="chatPlus" width={15.6} height={15.6} />
          </PressableScale>
          <View style={[styles.field, tall && styles.fieldTall]}>
            <TextInput
              value={text}
              onChangeText={setText}
              onContentSizeChange={(e) => setTall(e.nativeEvent.contentSize.height > LINE * 1.5)}
              placeholder="Message..."
              placeholderTextColor={SUBTLE}
              multiline
              selectionColor={colors.primary}
              cursorColor="#000000"
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

// AutoLayouted-29 (status bar 47): header to the 0.5 hairline at y 104.5 — back 13x26 at (14, 64), avatar 37.5 at
// (46, 58), name Inter 15.5 semibold and username 13 at x 94, call 22.25 at (303.25, 64.75), video 14.3 from the right.
// Card: avatar 105 28 under the header, name 16.4 semibold, line 14.5 #999. Bubbles: Inter 14.55 / 20.2, 14 / 7.9 padding,
// radius 18, mine #1E1E1E (white text) 7 from the right, theirs #F7F7F7 10 from the left. Stamps Inter 13 #999, 34.3
// above and 13.7 below. Composer: a #F7F7F7 40px "+" circle at x 18, the pill (44 tall, radius 22) from 64 to 383.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 58, borderBottomWidth: 0.5, borderBottomColor: '#E9E9E9' },
  back: { position: 'absolute', left: 14, top: 17 },
  who: { position: 'absolute', left: 46, top: 11, right: 100, flexDirection: 'row' },
  avatar: { width: 37.5, height: 37.5, borderRadius: 18.75, backgroundColor: colors.surfaceSoft },
  names: { flex: 1, marginLeft: 10.5, paddingTop: 2.66 },
  name: { fontFamily: INTER_FAMILIES['600'], fontSize: 15.5, lineHeight: 18, color: colors.text },
  username: { marginTop: -0.69, fontFamily: INTER_FAMILIES['400'], fontSize: 13, lineHeight: 16, color: colors.text },
  call: { position: 'absolute', left: 303.25, top: 17.75 },
  video: { position: 'absolute', right: 14.26, top: 18 },

  body: { flex: 1 },
  list: { paddingLeft: 10, paddingRight: 7, paddingTop: 12 },
  card: { alignItems: 'center', paddingTop: 28, marginBottom: -11.54 },
  cardAvatar: { width: 105, height: 105, borderRadius: 52.5, backgroundColor: colors.surfaceSoft },
  cardName: { marginTop: 9.45, maxWidth: 300, fontFamily: INTER_FAMILIES['600'], fontSize: 16.4, lineHeight: 20, color: colors.text },
  cardSub: { marginTop: 3.09, fontFamily: INTER_FAMILIES['400'], fontSize: 14.5, lineHeight: 17, color: SUBTLE },
  stamp: { marginTop: 34.28, marginBottom: 13.72, textAlign: 'center', fontFamily: INTER_FAMILIES['400'], fontSize: 13, lineHeight: 16, color: SUBTLE },
  bubble: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 7.9, borderRadius: 18 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#1E1E1E' },
  theirs: { alignSelf: 'flex-start', backgroundColor: BUBBLE },
  bubbleText: { fontFamily: INTER_FAMILIES['400'], fontSize: 14.55, lineHeight: BUBBLE_LINE, color: colors.text },
  mineText: { color: '#FFFFFF' },

  // "+" circle 40 at x 18, the pill from 64 to 383 (44 tall, radius 22; 25 once it grows), text Inter 14.5 from 21.6 in;
  // send pill 46x34 (white, radius 17) 5 from the right, 5 from the bottom.
  bar: { paddingTop: 8, paddingLeft: 18, paddingRight: 7, backgroundColor: '#FFFFFF' },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  plus: { width: 40, height: 40, borderRadius: 20, marginBottom: 2, backgroundColor: BUBBLE, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, minHeight: 44, borderRadius: 22, backgroundColor: BUBBLE, flexDirection: 'row', alignItems: 'flex-end' },
  fieldTall: { borderRadius: 25 },
  input: {
    flex: 1,
    maxHeight: LINE * MAX_LINES + 25,
    marginLeft: 21.6,
    marginRight: 15,
    paddingTop: 12.5,
    paddingBottom: 12.5,
    paddingHorizontal: 0,
    fontFamily: INTER_FAMILIES['400'],
    fontSize: 14.5,
    lineHeight: LINE,
    color: colors.text,
  },
  inputWithSend: { marginRight: 8 },
  sendWrap: { marginRight: 5, marginBottom: 5 },
  send: { width: 46, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
