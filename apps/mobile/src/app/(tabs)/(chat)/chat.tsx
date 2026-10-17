import { Image } from 'expo-image';
import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ConnectionRowSkeleton } from '@/components/skeleton';
import { INTER_FAMILIES, Text } from '@/components/text';
import { chatSocket, fetchConversations, otherMember, type Conversation } from '@/lib/chat';
import { push } from '@/lib/nav';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

const SUBTLE = '#999999';

type Row = { id: string; username: string; title: string; subtitle: string; avatar: string | null; unread: number };

// Chats list (AutoLayouts export): compose · own name · search, then the conversations — avatar 55, name and the last
// message, unread ones in semibold with a count badge. Search opens its own screen (chat-search).
export default function Chat() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);

  const load = useCallback(() => {
    fetchConversations()
      .then(setConversations)
      .catch(() => setConversations((c) => c ?? []));
  }, []);

  useFocusEffect(load);
  useEffect(() => {
    const socket = chatSocket();
    socket.on('message:new', load);
    socket.on('conversation:created', load);
    return () => {
      socket.off('message:new', load);
      socket.off('conversation:created', load);
    };
  }, [load]);

  const rows = useMemo<Row[]>(
    () =>
      (conversations ?? []).flatMap((c) => {
        const other = user ? otherMember(c, user.id) : null;
        if (!other) return [];
        const last = c.messages[0];
        const mine = last && last.senderId === user?.id;
        return [
          {
            id: c.id,
            username: other.username,
            title: other.displayName || other.username,
            subtitle: last ? `${mine ? 'You: ' : ''}${last.body ?? ''}` : 'No messages yet',
            avatar: other.avatarUrl,
            unread: c.unreadCount ?? 0,
          },
        ];
      }),
    [conversations, user],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <PressableScale onPress={() => push('/conversation/new' as Href)} hitSlop={10} scaleTo={0.88} accessibilityLabel="New message" style={styles.compose}>
          <Icon name="compose" width={24.25} />
        </PressableScale>
        <Text style={styles.title} numberOfLines={1}>
          {user?.name || user?.username || ''}
        </Text>
        <PressableScale onPress={() => push('/chat-search')} hitSlop={10} scaleTo={0.88} accessibilityLabel="Search chats" style={styles.search}>
          <Icon name="chatSearch" width={21.65} height={21.65} />
        </PressableScale>
      </View>

      <View style={styles.band} />

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          conversations ? (
            <Text style={styles.empty}>{'No chats yet.\nTap the pencil to message someone you follow.'}</Text>
          ) : (
            <Animated.View collapsable={false} exiting={FadeOut.duration(150)}>
              {Array.from({ length: 7 }, (_, i) => (
                <ConnectionRowSkeleton key={i} button={false} />
              ))}
            </Animated.View>
          )
        }
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => push(`/conversation/${item.id}?username=${encodeURIComponent(item.username)}` as Href)}
            scaleTo={0.98}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${item.title}`}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} transition={150} />
            ) : (
              <Icon name="avatarPlaceholder" width={53} style={styles.avatar} />
            )}
            <View style={styles.names}>
              <Text style={[styles.name, item.unread > 0 && styles.unread]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.sub, item.unread > 0 && styles.subUnread]} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
            {item.unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
              </View>
            ) : null}
          </PressableScale>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

// AutoLayouted 18: compose 24x24 at (14.5, 63), title Inter 21.3 bold centred, search 21.65 at (351.1, 63). First
// avatar at y 144, rows 78 apart: avatar 53 at x 14, name / message Inter 13.75 at x 80.1 (#999 message), badge 19 at
// 15 from the right edge, 18 below the avatar top.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: 43, alignItems: 'center' },
  compose: { position: 'absolute', left: 14.375, top: 15.875 },
  title: { marginTop: 13.18, maxWidth: 260, fontFamily: INTER_FAMILIES['700'], fontSize: 21.3, lineHeight: 26, color: colors.text },
  search: { position: 'absolute', right: 17.29, top: 16.03 },
  band: { height: 54 },
  row: { height: 78, flexDirection: 'row', paddingLeft: 14, paddingRight: 15 },
  avatar: { width: 53, height: 53, borderRadius: 26.5, backgroundColor: colors.surfaceSoft },
  names: { flex: 1, marginLeft: 13.1, marginRight: 12, paddingTop: 9.01 },
  name: { fontFamily: INTER_FAMILIES['400'], fontSize: 13.75, lineHeight: 17, color: '#000000' },
  unread: { fontFamily: INTER_FAMILIES['600'] },
  sub: { marginTop: 2, fontFamily: INTER_FAMILIES['400'], fontSize: 13.75, lineHeight: 17, color: SUBTLE },
  subUnread: { fontFamily: INTER_FAMILIES['600'], color: colors.text },
  badge: { marginTop: 18, minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 9.5, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: INTER_FAMILIES['700'], fontSize: 11.5, lineHeight: 14, color: '#FFFFFF' },
  empty: { marginTop: 40, textAlign: 'center', fontSize: 14, lineHeight: 19, color: colors.textSubtle },
});
