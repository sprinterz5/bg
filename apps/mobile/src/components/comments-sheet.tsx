import type { ApiComment, Page } from '@api/api';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { Easing, FadeInDown, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { appear } from '@/lib/appear';
import { shortAgo } from '@/lib/feed-api';
import { openProfile } from '@/lib/nav';
import { colors } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { INTER_FAMILIES, Text, TextInput } from './text';

// Not designed: a post's comments in a sheet like the share sheet (dimmed screen, 45 corners, pull down to close):
// "Comments" with the count, oldest first (avatar, name, time, text), and a field at the bottom that posts at once.
// Mock posts (not on the server) have no comments to show.
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { articleId: string; onClose: () => void };

export function CommentsSheet({ articleId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetH = Math.round(height * 0.72);
  const [comments, setComments] = useState<ApiComment[] | null>(UUID.test(articleId) ? null : []);
  const [cursor, setCursor] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const open = useSharedValue(0);
  const drag = useSharedValue(0);
  const { height: keyboard } = useReanimatedKeyboardAnimation();

  useEffect(() => {
    open.set(withTiming(1, { duration: 320, easing: EASE }));
  }, [open]);

  useEffect(() => {
    if (!UUID.test(articleId)) return;
    api<Page<ApiComment>>(`/comments?targetType=ARTICLE&targetId=${articleId}&limit=50`, { auth: true })
      .then((p) => {
        setComments(p.data);
        setCursor(p.nextCursor);
      })
      .catch(() => setComments([]));
  }, [articleId]);

  const more = () => {
    if (!cursor) return;
    const c = cursor;
    setCursor(null);
    api<Page<ApiComment>>(`/comments?targetType=ARTICLE&targetId=${articleId}&limit=50&cursor=${c}`, { auth: true })
      .then((p) => {
        setComments((list) => [...(list ?? []), ...p.data]);
        setCursor(p.nextCursor);
      })
      .catch(() => setCursor(c));
  };

  const close = () => {
    open.set(withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }, (done) => done && runOnJS(onClose)()));
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

  const backdrop = useAnimatedStyle(() => ({ opacity: open.get() * (1 - Math.min(1, drag.get() / sheetH)) }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - open.get()) * (sheetH + 40) + drag.get() + keyboard.get() * open.get() }],
  }));

  const send = () => {
    const body = text.trim();
    if (!body || sending || !UUID.test(articleId)) return;
    setSending(true);
    api<ApiComment>('/comments', { body: { targetType: 'ARTICLE', targetId: articleId, body }, auth: true, idempotent: true })
      .then((c) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setText('');
        setComments((list) => [...(list ?? []), c]);
        bumpCommentCount(articleId);
      })
      .catch(() => {})
      .finally(() => setSending(false));
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
            <Text style={styles.title}>Comments{comments && comments.length ? ` · ${comments.length}${cursor ? '+' : ''}` : ''}</Text>
          </View>
        </GestureDetector>
        {comments === null ? (
          <ActivityIndicator style={styles.loading} color={colors.textMuted} />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            onEndReached={more}
            onEndReachedThreshold={0.4}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No comments yet. Be the first.</Text>}
            renderItem={({ item, index }) => (
              <Animated.View collapsable={false} entering={appear(index) ?? FadeInDown.duration(240)} style={styles.row}>
                <Pressable onPress={() => openProfile(item.user.username, true)} hitSlop={6}>
                  {item.user.avatarUrl ? (
                    <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} transition={150} />
                  ) : (
                    <Icon name="avatarPlaceholder" width={34} style={styles.avatar} />
                  )}
                </Pressable>
                <View style={styles.texts}>
                  <Text style={styles.meta} numberOfLines={1}>
                    <Text style={styles.name}>{item.user.username}</Text>
                    {'  '}
                    {shortAgo(item.createdAt)}
                  </Text>
                  <Text style={styles.body}>{item.body}</Text>
                </View>
              </Animated.View>
            )}
          />
        )}
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) + 60 }]}>
          <View style={styles.field}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Add a comment..."
              placeholderTextColor="#8E8E93"
              multiline
              maxLength={1000}
              cursorColor={colors.text}
              style={styles.input}
              accessibilityLabel="Comment"
            />
            {text.trim() ? (
              <PressableScale onPress={send} disabled={sending} scaleTo={0.9} hitSlop={6} style={styles.send} accessibilityRole="button" accessibilityLabel="Post comment">
                <Text style={[styles.sendText, sending && styles.sendOff]}>Post</Text>
              </PressableScale>
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

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, borderTopLeftRadius: 45, borderTopRightRadius: 45, backgroundColor: colors.bg, overflow: 'hidden' },
  top: { paddingTop: 11, paddingBottom: 12, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#E9E9E9' },
  handle: { width: 53, height: 2, borderRadius: 1, backgroundColor: '#D9D9D9' },
  title: { marginTop: 14, fontFamily: INTER_FAMILIES['600'], fontSize: 15, lineHeight: 18, color: colors.text },
  loading: { marginTop: 40 },
  list: { paddingTop: 14, paddingBottom: 150, paddingHorizontal: 18 },
  empty: { marginTop: 40, textAlign: 'center', fontFamily: INTER_FAMILIES['400'], fontSize: 14, lineHeight: 18, color: colors.textMuted },
  row: { flexDirection: 'row', marginBottom: 18 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSoft },
  texts: { flex: 1, marginLeft: 11 },
  meta: { fontFamily: INTER_FAMILIES['400'], fontSize: 12.5, lineHeight: 16, color: colors.textMuted },
  name: { fontFamily: INTER_FAMILIES['600'], fontSize: 13, color: colors.text },
  body: { marginTop: 2, fontFamily: INTER_FAMILIES['400'], fontSize: 14.2, lineHeight: 19, color: colors.text },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10, paddingHorizontal: 14, backgroundColor: colors.bg, borderTopWidth: 0.5, borderTopColor: '#E9E9E9' },
  field: { minHeight: 44, borderRadius: 22, backgroundColor: '#F0F0F0', flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 8 },
  input: { flex: 1, paddingVertical: 10, maxHeight: 110, fontFamily: INTER_FAMILIES['400'], fontSize: 14.5, color: colors.text },
  send: { paddingHorizontal: 10, paddingVertical: 6 },
  sendText: { fontFamily: INTER_FAMILIES['600'], fontSize: 14.5, color: colors.primary },
  sendOff: { opacity: 0.4 },
});
