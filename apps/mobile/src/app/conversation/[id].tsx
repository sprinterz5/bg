import type { ApiProfile } from '@api/api';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAvoidingView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown, FadeOut, interpolate, LinearTransition, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { INTER_FAMILIES, Text, TextInput } from '@/components/text';
import { chatSocket, fetchMessages, markRead, sendMessage, sendPhotoMessage, type ChatMessage } from '@/lib/chat';
import { uploadImage } from '@/lib/media';
import * as ImagePicker from 'expo-image-picker';
import { back, openProfile, push } from '@/lib/nav';
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
  const [messages, setMessages] = useState<Row[]>([]); // newest first (inverted list)
  // Messages that arrived or were sent while the chat is open slide in; the loaded history doesn't.
  const fresh = useRef(new Set<string>());
  const localSeq = useRef(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [other, setOther] = useState<ApiProfile | null>(null);
  const [text, setText] = useState('');
  const [tall, setTall] = useState(false);

  const add = (m: ChatMessage) =>
    setMessages((list) => {
      if (list.some((x) => x.id === m.id)) return list;
      fresh.current.add(m.id);
      return [m, ...list];
    });

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

  // Not designed: the own message shows at once, faded until the server has it (it keeps its place and key when the
  // server's copy replaces it); a failed one stays with "Not sent · Tap to retry".
  const deliver = (key: string, body: string, photo?: { localUri: string; uploaded?: string }) => {
    if (!id) return;
    setMessages((list) => list.map((m) => (m.key === key ? { ...m, failed: false } : m)));
    const request = photo
      ? // a photo: uploaded once (kept for a retry), then sent as an IMAGE message
        (photo.uploaded ? Promise.resolve(photo.uploaded) : uploadImage(photo.localUri, 'CHAT_ATTACHMENT').then((a) => {
          setMessages((list) => list.map((m) => (m.key === key ? { ...m, uploaded: a.url } : m)));
          return a.url;
        })).then((url) => sendPhotoMessage(id, url))
      : sendMessage(id, body);
    request
      .then((m) =>
        setMessages((list) =>
          list.some((x) => x.id === m.id)
            ? list.filter((x) => x.key !== key) // the socket was quicker
            : list.map((x) => (x.key === key ? { ...m, key, localUri: x.localUri } : x)),
        ),
      )
      .catch(() => setMessages((list) => list.map((m) => (m.key === key ? { ...m, failed: true } : m))));
  };
  const send = () => {
    const body = text.trim();
    if (!id || !body || !user) return;
    setText('');
    const key = `local-${++localSeq.current}`;
    fresh.current.add(key);
    setMessages((list) => [{ id: key, key, conversationId: id, senderId: user.id, body, createdAt: new Date().toISOString(), pending: true }, ...list]);
    deliver(key, body);
  };

  // Not designed: "+" picks a photo from the library; it shows at once (faded until sent) like a text message.
  const sendPhoto = async () => {
    if (!id || !user) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    const uri = result.canceled ? null : result.assets[0]?.uri;
    if (!uri) return;
    const key = `local-${++localSeq.current}`;
    fresh.current.add(key);
    const row: Row = { id: key, key, conversationId: id, senderId: user.id, body: null, type: 'IMAGE', mediaUrl: null, localUri: uri, createdAt: new Date().toISOString(), pending: true };
    setMessages((list) => [row, ...list]);
    deliver(key, '', { localUri: uri });
  };
  const [viewing, setViewing] = useState<string | null>(null);

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
        <Animated.FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.key ?? m.id}
          itemLayoutAnimation={LinearTransition.duration(220)}
          ListFooterComponent={loaded && !cursor ? card : null}
          renderItem={({ item, index }) => {
            const mine = item.senderId === user?.id;
            const older = messages[index + 1];
            const stamp = !older || new Date(item.createdAt).getTime() - new Date(older.createdAt).getTime() > RUN_GAP;
            const key = item.key ?? item.id;
            const waiting = item.key && item.key === item.id; // still the local copy
            return (
              // the list is inverted (flipped): "down" here comes in from below on screen
              <Animated.View entering={fresh.current.has(key) ? FadeInDown.duration(240) : undefined}>
                {stamp ? <Text style={styles.stamp}>{formatStamp(item.createdAt)}</Text> : null}
                {item.replyToStory ? <StoryReply mine={mine} story={item.replyToStory} /> : null}
                {item.type === 'SHARE_ARTICLE' ? <SharedPost mine={mine} post={item.sharedArticle ?? null} first={!stamp && older?.senderId !== item.senderId} /> : null}
                {item.type === 'IMAGE' ? (
                  <Pressable onPress={() => setViewing(item.localUri ?? item.mediaUrl ?? null)} accessibilityRole="imagebutton" accessibilityLabel="Photo" style={[styles.photo, mine ? styles.postMine : styles.postTheirs, { marginTop: !stamp && older?.senderId === item.senderId ? 7 : 12 }, waiting && !item.failed ? styles.pending : undefined]}>
                    <Image source={{ uri: item.localUri ?? item.mediaUrl ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                  </Pressable>
                ) : null}
                {(item.type === 'SHARE_ARTICLE' || item.type === 'IMAGE') && !item.body ? null : <Bubble mine={mine} body={item.body ?? ''} style={[!stamp ? { marginTop: older?.senderId === item.senderId ? 7 : 12 } : undefined, waiting && !item.failed ? styles.pending : undefined]} />}
                {item.failed ? (
                  <Pressable onPress={() => deliver(key, item.body ?? '', item.localUri ? { localUri: item.localUri, uploaded: item.uploaded } : undefined)} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.failed}>Not sent · Tap to retry</Text>
                  </Pressable>
                ) : null}
              </Animated.View>
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
          <PressableScale onPress={sendPhoto} scaleTo={0.9} accessibilityLabel="Send a photo" style={styles.plus}>
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
              cursorColor="#000000"
              style={[styles.input, hasText && styles.inputWithSend]}
              accessibilityLabel="Message"
            />
            {hasText ? (
              <Animated.View collapsable={false} entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={styles.sendWrap}>
                <PressableScale haptic onPress={send} scaleTo={0.9} hitSlop={6} style={styles.send} accessibilityRole="button" accessibilityLabel="Send">
                  <Icon name="chatSend" width={20.82} height={18.16} />
                </PressableScale>
              </Animated.View>
            ) : null}
          </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* a photo full screen; a tap closes it */}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)} statusBarTranslucent>
        <Pressable style={styles.viewer} onPress={() => setViewing(null)} accessibilityLabel="Close photo">
          {viewing ? <Image source={{ uri: viewing }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
        </Pressable>
      </Modal>
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
// Not designed: a reply to a story shows the story (small, rounded) above the text with who replied; once the story
// has expired a grey box says so.
function StoryReply({ mine, story }: { mine: boolean; story: NonNullable<ChatMessage['replyToStory']> }) {
  const [now] = useState(Date.now);
  const live = new Date(story.expiresAt).getTime() > now;
  return (
    <View style={[styles.reply, mine ? styles.replyMine : styles.replyTheirs]}>
      <Text style={styles.replyLabel}>{mine ? 'You replied to their story' : 'Replied to your story'}</Text>
      {live ? (
        <Image source={{ uri: story.mediaUrl }} style={styles.replyStory} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.replyStory, styles.replyGone]}>
          <Text style={styles.replyGoneText}>Story unavailable</Text>
        </View>
      )}
    </View>
  );
}

// Not designed: a shared post is a card (cover, title, author) on the sender's side; a tap opens the post. When the
// post is gone, a grey card says so.
function SharedPost({ mine, post, first }: { mine: boolean; post: NonNullable<ChatMessage['sharedArticle']> | null; first: boolean }) {
  return (
    <PressableScale
      onPress={post ? () => push(`/article/${post.id}`) : undefined}
      disabled={!post}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={post ? `Post: ${post.title}` : 'Post unavailable'}
      style={[styles.post, mine ? styles.postMine : styles.postTheirs, { marginTop: first ? 12 : 7 }]}>
      {post ? (
        <>
          {post.coverImageUrl ? <Image source={{ uri: post.coverImageUrl }} style={styles.postCover} contentFit="cover" transition={150} /> : null}
          <View style={styles.postBody}>
            <Text style={styles.postAuthor} numberOfLines={1}>
              {post.author.displayName ?? post.author.username}
            </Text>
            <Text style={styles.postTitle} numberOfLines={2}>
              {post.title}
            </Text>
          </View>
        </>
      ) : (
        <Text style={[styles.replyGoneText, styles.postGone]}>Post unavailable</Text>
      )}
    </PressableScale>
  );
}

function Bubble({ mine, body, style }: { mine: boolean; body: string; style?: StyleProp<ViewStyle> }) {
  const [multi, setMulti] = useState(false);
  return (
    <View style={[styles.bubble, multi && styles.bubbleMulti, mine ? styles.mine : styles.theirs, style]}>
      <Text onTextLayout={(e) => setMulti(e.nativeEvent.lines.length > 1)} style={[styles.bubbleText, mine && styles.mineText]}>
        {body}
      </Text>
    </View>
  );
}

/** A message in the list; `key` stays the same from the local copy to the server's one (no remount). */
type Row = ChatMessage & { key?: string; pending?: boolean; failed?: boolean; localUri?: string; uploaded?: string };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 58, borderBottomWidth: 0.5, borderBottomColor: '#E9E9E9' },
  back: { position: 'absolute', left: 14, top: 17 },
  who: { position: 'absolute', left: 46, top: 11, right: 100, flexDirection: 'row' },
  avatar: { width: 37.5, height: 37.5, borderRadius: 18.75, backgroundColor: colors.surfaceSoft },
  names: { flex: 1, marginLeft: 10.5, paddingTop: 2.66 },
  name: { fontFamily: INTER_FAMILIES['600'], fontSize: 15.2, lineHeight: 18, color: colors.text },
  username: { marginTop: -0.69, fontFamily: INTER_FAMILIES['400'], fontSize: 13, lineHeight: 16, color: colors.text },
  call: { position: 'absolute', left: 303.25, top: 17.75 },
  video: { position: 'absolute', right: 14.26, top: 18 },

  body: { flex: 1 },
  list: { paddingLeft: 10, paddingRight: 7, paddingTop: 7 },
  card: { alignItems: 'center', paddingTop: 28, marginBottom: -11.54 },
  cardAvatar: { width: 105, height: 105, borderRadius: 52.5, backgroundColor: colors.surfaceSoft },
  cardName: { marginTop: 9.45, maxWidth: 300, fontFamily: INTER_FAMILIES['600'], fontSize: 16, lineHeight: 20, color: colors.text },
  cardSub: { marginTop: 3.09, fontFamily: INTER_FAMILIES['500'], fontSize: 14.2, lineHeight: 17, color: SUBTLE },
  stamp: { marginTop: 34.28, marginBottom: 13.72, textAlign: 'center', fontFamily: INTER_FAMILIES['400'], fontSize: 13, lineHeight: 16, color: SUBTLE },
  bubble: { maxWidth: '87.5%', paddingHorizontal: 14, paddingVertical: 7.9, borderRadius: 18 },
  // AutoLayouted-26: a bubble of several lines gets a little more padding and a smaller radius (15)
  bubbleMulti: { paddingVertical: 8.9, borderRadius: 15 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#1E1E1E' },
  theirs: { alignSelf: 'flex-start', backgroundColor: BUBBLE },
  bubbleText: { fontFamily: INTER_FAMILIES['400'], fontSize: 14.55, lineHeight: BUBBLE_LINE, color: colors.text },
  mineText: { color: '#FFFFFF' },
  pending: { opacity: 0.55 },
  failed: { alignSelf: 'flex-end', marginTop: 4, fontFamily: INTER_FAMILIES['400'], fontSize: 12, lineHeight: 15, color: colors.danger },
  reply: { marginTop: 12, marginBottom: -5 },
  replyMine: { alignItems: 'flex-end' },
  replyTheirs: { alignItems: 'flex-start' },
  replyLabel: { marginBottom: 6, fontFamily: INTER_FAMILIES['400'], fontSize: 12, lineHeight: 15, color: SUBTLE },
  replyStory: { width: 96, height: 170, borderRadius: 12, backgroundColor: BUBBLE },
  photo: { width: 210, height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: BUBBLE },
  viewer: { flex: 1, backgroundColor: '#000000' },
  post: { width: 240, borderRadius: 16, backgroundColor: BUBBLE, overflow: 'hidden' },
  postMine: { alignSelf: 'flex-end' },
  postTheirs: { alignSelf: 'flex-start' },
  postCover: { width: 240, height: 150 },
  postBody: { paddingHorizontal: 12, paddingTop: 9, paddingBottom: 11 },
  postAuthor: { fontFamily: INTER_FAMILIES['500'], fontSize: 12, lineHeight: 15, color: SUBTLE },
  postTitle: { marginTop: 2, fontFamily: INTER_FAMILIES['600'], fontSize: 14.5, lineHeight: 19, color: colors.text },
  postGone: { paddingVertical: 18, paddingHorizontal: 14 },
  replyGone: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  replyGoneText: { textAlign: 'center', fontFamily: INTER_FAMILIES['400'], fontSize: 12, lineHeight: 15, color: SUBTLE },

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
