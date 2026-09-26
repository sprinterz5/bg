import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConnectionsScreen } from '@/components/connections-screen';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Text } from '@/components/text';
import { chatSocket, fetchConversations, otherMember, type Conversation } from '@/lib/chat';
import { push } from '@/lib/nav';
import type { Connection } from '@/mock/data';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// Figma 3185:1524 — own username centred with a compose button, search, then the conversations
// (the frame shows people rows; the last message goes where the frame has the second line).
export default function Chat() {
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

  const items: Connection[] = (conversations ?? []).flatMap((c) => {
    const other = user ? otherMember(c, user.id) : null;
    if (!other) return [];
    const last = c.messages[0];
    const mine = last && last.senderId === user?.id;
    return [
      {
        id: c.id,
        username: other.username,
        subtitle: last ? `${mine ? 'You: ' : ''}${last.body ?? ''}` : 'No messages yet',
        avatar: other.avatarUrl ? { uri: other.avatarUrl } : null,
        following: false,
      },
    ];
  });

  const header = (
    <View style={styles.header}>
      <Text style={styles.title} numberOfLines={1}>
        {user?.username ?? ''}
      </Text>
      <PressableScale onPress={() => push('/conversation/new' as Href)} hitSlop={10} scaleTo={0.88} accessibilityLabel="New message" style={styles.compose}>
        <Icon name="compose" width={24.25} />
      </PressableScale>
    </View>
  );

  return (
    <ConnectionsScreen
      title="Messages"
      header={header}
      withButtons={false}
      items={items}
      onOpen={(c) => push(`/conversation/${c.id}?username=${encodeURIComponent(c.username)}` as Href)}
      empty={
        conversations ? (
          <Text style={styles.empty}>No chats yet.{'\n'}Tap the pencil to message someone you follow.</Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  // title centred 2.65px left of the screen centre, compose (24.25 with stroke) at x 351.9 / y 60.9; search field starts at y 109
  header: { height: 62, paddingBottom: 6, alignItems: 'center', justifyContent: 'center' },
  title: { maxWidth: 240, fontSize: 21, lineHeight: 26, fontWeight: '700', color: colors.text, transform: [{ translateX: -2.65 }] },
  compose: { position: 'absolute', right: 13.875, top: 13.875 },
  empty: { marginTop: 40, textAlign: 'center', fontSize: 14, lineHeight: 19, color: colors.textSubtle },
});
