import type { ApiComment, Page } from '@api/api';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, StyleSheet, View, useWindowDimensions, type TextInputInstance } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { appear } from '@/lib/appear';
import { shortAgo } from '@/lib/feed-api';
import { openProfile } from '@/lib/nav';
import { useSession } from '@/state/session';
import { colors } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { INTER_FAMILIES, Text, TextInput } from './text';

// A post's comments in a sheet over the dimmed screen (pull down to close): oldest first, likes, replies under their
// comment (opened on demand), Reply puts @name into the field. Mock posts (not on the server) have no comments.
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { articleId: string; onClose: () => void };
type Row = ApiComment & { depth: 0 | 1 };

const compact = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}K`.replace('.0K', 'K') : String(n));

export function CommentsSheet({ articleId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { user: me } = useSession();
  // the sheet's top edge sits at y 255 of the frame
  const sheetH = height - (insets.top + 208);
  const [comments, setComments] = useState<ApiComment[] | null>(UUID.test(articleId) ? null : []);
  const [cursor, setCursor] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, ApiComment[]>>({});
  const [open, setOpenIds] = useState<Record<string, boolean>>({});
  const [likes, setLikes] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [replyTo, setReplyTo] = useState<ApiComment | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const input = useRef<TextInputInstance>(null);
  const shown = useSharedValue(0);
  const drag = useSharedValue(0);
  const { height: keyboard } = useReanimatedKeyboardAnimation();

  useEffect(() => {
    shown.set(withTiming(1, { duration: 320, easing: EASE }));
  }, [shown]);

  const url = (parentId?: string, c?: string) =>
    `/comments?targetType=ARTICLE&targetId=${articleId}&limit=50${parentId ? `&parentId=${parentId}` : ''}${c ? `&cursor=${c}` : ''}`;

  useEffect(() => {
    if (!UUID.test(articleId)) return;
    api<Page<ApiComment>>(url(), { auth: true })
      .then((p) => {
        setComments(p.data);
        setCursor(p.nextCursor);
      })
      .catch(() => setComments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  const more = () => {
    if (!cursor) return;
    const c = cursor;
    setCursor(null);
    api<Page<ApiComment>>(url(undefined, c), { auth: true })
      .then((p) => {
        setComments((list) => [...(list ?? []), ...p.data]);
        setCursor(p.nextCursor);
      })
      .catch(() => setCursor(c));
  };

  const toggleReplies = (c: ApiComment) => {
    const next = !open[c.id];
    setOpenIds((o) => ({ ...o, [c.id]: next }));
    if (next && !replies[c.id]) {
      api<Page<ApiComment>>(url(c.id), { auth: true })
        .then((p) => setReplies((r) => ({ ...r, [c.id]: p.data })))
        .catch(() => setOpenIds((o) => ({ ...o, [c.id]: false })));
    }
  };

  const likeOf = (c: ApiComment) => likes[c.id] ?? { liked: !!c.liked, count: c.likesCount ?? 0 };
  const toggleLike = (c: ApiComment) => {
    const cur = likeOf(c);
    const liked = !cur.liked;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLikes((l) => ({ ...l, [c.id]: { liked, count: Math.max(0, cur.count + (liked ? 1 : -1)) } }));
    api('/likes/toggle', { body: { targetType: 'COMMENT', targetId: c.id, liked }, auth: true }).catch(() =>
      setLikes((l) => ({ ...l, [c.id]: cur })),
    );
  };

  const reply = (c: ApiComment, parent: ApiComment) => {
    setReplyTo(parent);
    setText(`@${c.user.username} `);
    input.current?.focus();
  };

  const close = () => {
    shown.set(withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }, (done) => done && runOnJS(onClose)()));
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  });

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      drag.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (drag.get() > 120 || e.velocityY > 900) runOnJS(close)();
      else drag.set(withTiming(0, { duration: 200, easing: EASE }));
    });

  const backdrop = useAnimatedStyle(() => ({ opacity: shown.get() * (1 - Math.min(1, drag.get() / sheetH)) }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - shown.get()) * (sheetH + 40) + drag.get() + keyboard.get() * shown.get() }],
  }));

  const send = () => {
    const body = text.trim();
    if (!body || sending || !UUID.test(articleId)) return;
    // a reply only while the text still starts with the mention it was opened with
    const parent = replyTo && body.startsWith('@') ? replyTo : null;
    setSending(true);
    api<ApiComment>('/comments', {
      body: { targetType: 'ARTICLE', targetId: articleId, body, ...(parent ? { parentId: parent.id } : {}) },
      auth: true,
      idempotent: true,
    })
      .then((c) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setText('');
        setReplyTo(null);
        if (parent) {
          setReplies((r) => ({ ...r, [parent.id]: [...(r[parent.id] ?? []), c] }));
          setOpenIds((o) => ({ ...o, [parent.id]: true }));
          setComments((list) =>
            (list ?? []).map((x) => (x.id === parent.id ? { ...x, _count: { children: (x._count?.children ?? 0) + 1 } } : x)),
          );
        } else setComments((list) => [...(list ?? []), c]);
        bumpCommentCount(articleId);
      })
      .catch(() => {})
      .finally(() => setSending(false));
  };

  // top-level comments with their opened replies under them
  const rows: Row[] = [];
  for (const c of comments ?? []) {
    rows.push({ ...c, depth: 0 });
    if (open[c.id]) for (const r of replies[c.id] ?? []) rows.push({ ...r, depth: 1 });
  }

  const renderItem = ({ item, index }: { item: Row; index: number }) => {
    const parent = item.depth ? (comments ?? []).find((c) => c.id === item.parentId) : item;
    const like = likeOf(item);
    const nReplies = item.depth ? 0 : (item._count?.children ?? 0);
    const lastReply = item.depth === 1 && rows[index + 1]?.depth !== 1;
    const size = item.depth ? 24 : 31;
    return (
      <Animated.View collapsable={false} entering={appear(index) ?? FadeInDown.duration(240)}>
        <View style={[styles.row, item.depth ? styles.replyRow : null]}>
          <Pressable onPress={() => openProfile(item.user.username, true)} hitSlop={6}>
            {item.user.avatarUrl ? (
              <Image source={{ uri: item.user.avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} transition={150} />
            ) : (
              <Icon name="avatarPlaceholder" width={size} />
            )}
          </Pressable>
          <View style={styles.texts}>
            <Text style={styles.meta} numberOfLines={1}>
              <Text style={styles.name}>{item.user.username}</Text> {shortAgo(item.createdAt)}
            </Text>
            <Text style={styles.body}>
              {item.body.split(/(@[\w.]+)/).map((part, i) =>
                part.startsWith('@') ? (
                  <Text key={i} style={styles.mention}>
                    {part}
                  </Text>
                ) : (
                  part
                ),
              )}
            </Text>
            <View style={styles.actions}>
              <PressableScale onPress={() => toggleLike(item)} scaleTo={0.85} hitSlop={8} style={styles.like} accessibilityRole="button" accessibilityLabel={like.liked ? 'Unlike' : 'Like'}>
                <Icon name={like.liked ? 'feedLikeFilled' : 'rowLike'} width={15} />
                <Text style={styles.action}>{compact(like.count)}</Text>
              </PressableScale>
              {item.depth === 0 && parent ? (
                <Pressable onPress={() => reply(item, parent)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.action}>Reply</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
        {nReplies > 0 && !open[item.id] ? (
          <Pressable onPress={() => toggleReplies(item)} hitSlop={6} style={styles.toggle} accessibilityRole="button">
            <View style={styles.toggleLine} />
            <Text style={styles.action}>Open {nReplies} {nReplies === 1 ? 'reply' : 'replies'}</Text>
          </Pressable>
        ) : null}
        {lastReply && parent ? (
          <Pressable onPress={() => toggleReplies(parent)} hitSlop={6} style={styles.toggle} accessibilityRole="button">
            <View style={styles.toggleLine} />
            <Text style={styles.action}>Hide replies</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { top: height - sheetH, height: sheetH + 60 }, sheet]}>
        <GestureDetector gesture={pan}>
          <View collapsable={false} style={styles.top}>
            <View style={styles.handle} />
            <Text style={styles.title}>Comments</Text>
          </View>
        </GestureDetector>
        {comments === null ? (
          <ActivityIndicator style={styles.loading} color={colors.textMuted} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(c) => c.id}
            onEndReached={more}
            onEndReachedThreshold={0.4}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No comments yet. Be the first.</Text>}
            renderItem={renderItem}
          />
        )}
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) + 60 }]}>
          {me?.avatarUri ? (
            <Image source={{ uri: me.avatarUri }} style={styles.myAvatar} transition={150} />
          ) : (
            <Icon name="avatarPlaceholder" width={43} style={styles.myAvatar} />
          )}
          <View style={styles.field}>
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              placeholder="What would you say about this article?"
              placeholderTextColor="#A1A1A1"
              multiline
              maxLength={1000}
              cursorColor={colors.text}
              style={styles.input}
              accessibilityLabel="Comment"
            />
            {text.trim() ? (
              <Animated.View collapsable={false} entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)}>
                <PressableScale haptic onPress={send} disabled={sending} scaleTo={0.9} hitSlop={6} style={[styles.send, sending && styles.sendOff]} accessibilityRole="button" accessibilityLabel="Post comment">
                  <Icon name="chatSend" width={18.7901} height={16.3894} />
                </PressableScale>
              </Animated.View>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// A comment posted here adds to the post's counter on its card and in the reader (kept per post for the session).
const added = new Map<string, number>();
const listeners = new Set<() => void>();
function bumpCommentCount(id: string) {
  added.set(id, (added.get(id) ?? 0) + 1);
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useAddedComments(id: string) {
  return useSyncExternalStore(subscribe, () => added.get(id) ?? 0);
}

// Frame AutoLayouted-26/-30: sheet from y 255 (r 45), handle 52×2, "Comments" Inter 600 16; comment avatar 31 at x 13,
// name/body at x 53.5 (Inter 600 / 400 13.5, line 17), actions grey 12.5; replies indented (avatar 24 at x 53, text
// at x 86.5); "Open N replies" / "Hide replies" after an 18-wide line; the bar: own avatar 43, a 48-high pill field.
const GREY = '#9B9B9B';
const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, borderTopLeftRadius: 45, borderTopRightRadius: 45, backgroundColor: colors.bg, overflow: 'hidden' },
  top: { paddingTop: 13, height: 62, alignItems: 'center' },
  handle: { width: 52, height: 2, borderRadius: 1, backgroundColor: '#8E8E93' },
  title: { marginTop: 14, fontFamily: INTER_FAMILIES['600'], fontSize: 16, lineHeight: 20, color: colors.text },
  loading: { marginTop: 40 },
  list: { paddingTop: 16, paddingBottom: 150, paddingLeft: 13, paddingRight: 24 },
  empty: { marginTop: 40, textAlign: 'center', fontFamily: INTER_FAMILIES['400'], fontSize: 14, lineHeight: 18, color: colors.textMuted },
  row: { flexDirection: 'row', marginBottom: 22 },
  replyRow: { marginLeft: 40 },
  texts: { flex: 1, marginLeft: 9.5 },
  meta: { fontFamily: INTER_FAMILIES['400'], fontSize: 13.5, lineHeight: 17, color: '#A8A8A8' },
  name: { fontFamily: INTER_FAMILIES['600'], color: colors.text },
  body: { marginTop: 3, fontFamily: INTER_FAMILIES['400'], fontSize: 13.5, lineHeight: 17, color: colors.text },
  mention: { color: '#4B5EE8' },
  actions: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  like: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  action: { marginLeft: 6, fontFamily: INTER_FAMILIES['600'], fontSize: 12.5, lineHeight: 15, color: GREY },
  toggle: { flexDirection: 'row', alignItems: 'center', marginLeft: 45, marginTop: -8, marginBottom: 22 },
  toggleLine: { width: 18, height: 1, backgroundColor: '#D9D9D9', marginRight: 5 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10, paddingLeft: 12, paddingRight: 16, flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.bg, borderTopWidth: 0.5, borderTopColor: '#E9E9E9' },
  myAvatar: { width: 43, height: 43, borderRadius: 21.5, marginTop: 2.5, backgroundColor: colors.surfaceSoft },
  field: { flex: 1, marginLeft: 7.5, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: '#E5E5E5', flexDirection: 'row', alignItems: 'center', paddingLeft: 16.5, paddingRight: 3 },
  input: { flex: 1, paddingVertical: 12, maxHeight: 110, fontFamily: INTER_FAMILIES['400'], fontSize: 14.5, color: colors.text },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
});
