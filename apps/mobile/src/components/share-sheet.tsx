import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Alert, BackHandler, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { openDirect, searchAccounts, sendMessage, type ChatUser } from '@/lib/chat';
import { fetchConnections } from '@/lib/users';
import { useSession } from '@/state/session';
import { colors } from '@/theme';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { INTER_FAMILIES, Text, TextInput } from './text';

// NOAutoLayout / Autolayouted-5 / -6: the reader dimmed (black 45%), a sheet 474 tall with 45 corners — handle,
// search field, 3 columns of 75px avatars (x 28 / 157 / 286, rows 121 apart) with names, a black check on the
// chosen ones, and Send (black once someone is chosen, grey before) on a white bar under a hairline.
const SHEET_H = 474;
const COLS = [28, 157, 286];
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { article: { id: string; title: string }; onClose: () => void };

export function ShareSheet({ article, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { user } = useSession();
  const [people, setPeople] = useState<ChatUser[]>([]);
  const [found, setFound] = useState<ChatUser[] | null>(null);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Record<string, ChatUser>>({});
  const [sending, setSending] = useState(false);
  const open = useSharedValue(0);
  const drag = useSharedValue(0);
  const { height: keyboard } = useReanimatedKeyboardAnimation();
  const q = query.trim();

  useEffect(() => {
    open.set(withTiming(1, { duration: 320, easing: EASE }));
  }, [open]);

  // Whom the user follows; typing searches all accounts.
  useEffect(() => {
    if (!user) return;
    fetchConnections(user.username, 'following')
      .then((rows) => setPeople(rows.filter((r) => !r.isMe)))
      .catch(() => {});
  }, [user]);
  useEffect(() => {
    if (!q) return;
    let alive = true;
    const t = setTimeout(() => {
      searchAccounts(q)
        .then((rows) => alive && setFound(rows.filter((r) => r.id !== user?.id)))
        .catch(() => alive && setFound([]));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, user?.id]);

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

  // Pull the sheet down by its top (handle + field band) to dismiss it.
  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      drag.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (drag.get() > 120 || e.velocityY > 900) {
        runOnJS(close)();
      } else {
        drag.set(withTiming(0, { duration: 200, easing: EASE }));
      }
    });

  const backdrop = useAnimatedStyle(() => ({ opacity: open.get() * (1 - Math.min(1, drag.get() / SHEET_H)) }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - open.get()) * (SHEET_H + 40) + drag.get() + keyboard.get() * open.get() }],
  }));

  const toggle = (u: ChatUser) => {
    Haptics.selectionAsync().catch(() => {});
    setChosen((c) => {
      const next = { ...c };
      if (next[u.id]) delete next[u.id];
      else next[u.id] = u;
      return next;
    });
  };

  const send = async () => {
    const to = Object.values(chosen);
    if (!to.length || sending) return;
    setSending(true);
    try {
      await Promise.all(
        to.map(async (u) => {
          const c = await openDirect(u.id);
          // Mock articles have no backend id: their title goes as a text message instead.
          if (UUID.test(article.id)) {
            await api('/share', { body: { targetType: 'ARTICLE', targetId: article.id, conversationId: c.id, source: 'reader' }, auth: true, idempotent: true });
          } else {
            await sendMessage(c.id, article.title);
          }
        }),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      close();
    } catch {
      setSending(false);
      Alert.alert("Couldn't send", 'Check the connection and try again.');
    }
  };

  const list = q ? (found ?? []) : people;
  const any = Object.keys(chosen).length > 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { top: height - SHEET_H, height: SHEET_H + 60 }, sheet]}>
        <GestureDetector gesture={pan}>
          <View collapsable={false} style={styles.top}>
            <View style={styles.handle} />
            <View style={styles.field}>
              <Icon name="searchFieldThin" width={14.38} height={14.38} tintColor="#8E8E93" style={styles.fieldIcon} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor="#6B6B6B"
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                cursorColor={colors.text}
                style={styles.input}
                accessibilityLabel="Search people"
              />
            </View>
          </View>
        </GestureDetector>
        <FlatList
          data={list}
          keyExtractor={(u) => u.id}
          numColumns={3}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 26.5, paddingBottom: 140 }}
          renderItem={({ item, index }) => (
            <PressableScale onPress={() => toggle(item)} scaleTo={0.94} style={[styles.person, { left: COLS[index % 3] }]} accessibilityRole="checkbox" accessibilityState={{ checked: !!chosen[item.id] }} accessibilityLabel={item.username}>
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} transition={150} />
              ) : (
                <Icon name="avatarPlaceholder" width={75} style={styles.avatar} />
              )}
              {chosen[item.id] ? <Icon name="shareCheck" width={23} height={23} style={styles.check} /> : null}
              <Text style={styles.name} numberOfLines={1}>
                {item.username}
              </Text>
            </PressableScale>
          )}
        />
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom - 2, 12) + 60 }]}>
          <PressableScale haptic onPress={send} disabled={!any || sending} scaleTo={0.97} style={[styles.send, (!any || sending) && styles.sendOff]} accessibilityRole="button" accessibilityLabel="Send">
            <Text style={styles.sendText}>Send</Text>
          </PressableScale>
        </View>
      </Animated.View>
    </View>
  );
}

// Sheet-relative (design y − 370): handle 53x2 at 11, field 345x43 at (22.5, 40.5) radius 21.5 #F0F0F0 with the icon at
// (15.9, 14.2) and "Search" Inter 14.8 at x 45.7; first avatar row at 110; names Inter 12.2 6.5 under the avatar;
// the bar's hairline at 393.5 (white below), Send 333x38 at x 28, 10.5 under it. The sheet runs 60 past the
// bottom so the keyboard lift and the drag never open a gap.
const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, borderTopLeftRadius: 45, borderTopRightRadius: 45, backgroundColor: colors.bg, overflow: 'hidden' },
  top: { height: 83.5 },
  handle: { position: 'absolute', top: 11, alignSelf: 'center', width: 53, height: 2, borderRadius: 1, backgroundColor: '#8E8E93' },
  field: { position: 'absolute', left: 22.5, right: 22.5, top: 40.5, height: 43, borderRadius: 21.5, backgroundColor: '#F0F0F0' },
  fieldIcon: { position: 'absolute', left: 15.9, top: 14.24 },
  input: { position: 'absolute', left: 45.7, right: 16, top: 0, height: 43, padding: 0, fontFamily: INTER_FAMILIES['400'], fontSize: 14.8, color: colors.text },
  person: { width: 75, height: 121, marginRight: -75 },
  avatar: { width: 75, height: 75, borderRadius: 37.5, backgroundColor: colors.surfaceSoft },
  check: { position: 'absolute', left: 55.5, top: 53.5 },
  name: { marginTop: 6.48, marginHorizontal: -20, textAlign: 'center', fontFamily: INTER_FAMILIES['400'], fontSize: 12.2, lineHeight: 15, color: '#000000' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10.5, backgroundColor: '#FFFFFF', borderTopWidth: 0.5, borderTopColor: '#EFF3F4' },
  send: { marginHorizontal: 28, height: 38, borderRadius: 7, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: '#B3B3B3' },
  sendText: { fontFamily: INTER_FAMILIES['600'], fontSize: 13.85, lineHeight: 17, color: '#FFFFFF' },
});
