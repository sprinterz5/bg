import { Image } from 'expo-image';
import { Stack, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { INTER_FAMILIES, Text, TextInput } from '@/components/text';
import {
  fetchConversations,
  openDirect,
  otherMember,
  searchAccounts,
  searchMessages,
  type ChatMessage,
  type ChatUser,
  type Conversation,
} from '@/lib/chat';
import { back, push } from '@/lib/nav';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

// AutoLayouted 21 / 22 / 23. Field with back and clear; once there is a query, tabs All / Messages / Accounts over the
// hits: chats by name ("last message · 1d"), accounts with no chat yet ("start chatting") and messages
// (“match…” with the match in black). Nothing found: the person-cross circle and a line under it.
const TABS = ['All', 'Messages', 'Accounts'] as const;
type Tab = (typeof TABS)[number];
const MUTED = '#999999';
const LINE = '#E9E9E9';
const UNDERLINE_W = 24;

type Hit = {
  key: string;
  kind: 'chat' | 'account' | 'message';
  user: ChatUser;
  conversationId?: string;
  /** Plain grey line, or the matched message split for highlighting. */
  sub: string | { match: string; rest: string };
};

export default function ChatSearch() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('All');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [accounts, setAccounts] = useState<ChatUser[]>([]);
  // The query the shown messages / accounts belong to; anything else is still loading.
  const [resultsFor, setResultsFor] = useState('');
  const q = query.trim();
  const loading = q !== resultsFor;

  useEffect(() => {
    fetchConversations()
      .then(setConversations)
      .catch(() => {});
  }, []);

  // Messages and accounts come from the backend, 250ms after the last keystroke.
  useEffect(() => {
    if (!q) return;
    let alive = true;
    const t = setTimeout(() => {
      Promise.all([searchMessages(q).catch(() => []), searchAccounts(q).catch(() => [])])
        .then(([m, a]) => {
          if (!alive) return;
          setMessages(m);
          setAccounts(a);
          setResultsFor(q);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const hits = useMemo(() => {
    if (!q || !user) return { chats: [], messages: [], accounts: [] };
    const lower = q.toLowerCase();
    const byConversation = new Map(conversations.map((c) => [c.id, c]));
    const chats: Hit[] = conversations.flatMap((c) => {
      const other = otherMember(c, user.id);
      if (!other || !(other.username.toLowerCase().includes(lower) || other.displayName?.toLowerCase().includes(lower))) return [];
      const last = c.messages[0];
      return [{ key: `c${c.id}`, kind: 'chat', user: other, conversationId: c.id, sub: last ? `${last.body ?? ''} · ${shortAgo(last.createdAt)}` : 'start chatting' }];
    });
    const chatUsers = new Set(chats.map((h) => h.user.id));
    const people: Hit[] = accounts
      .filter((a) => a.id !== user.id && !chatUsers.has(a.id))
      .map((a) => {
        const existing = conversations.find((c) => otherMember(c, user.id)?.id === a.id);
        return { key: `a${a.id}`, kind: 'account', user: a, conversationId: existing?.id, sub: existing ? 'seen recently' : 'start chatting' };
      });
    const found: Hit[] = messages.flatMap((m) => {
      const c = byConversation.get(m.conversationId);
      const other = c && otherMember(c, user.id);
      if (!other || !m.body) return [];
      const at = m.body.toLowerCase().indexOf(lower);
      if (at < 0) return [];
      return [{ key: `m${m.id}`, kind: 'message', user: other, conversationId: c.id, sub: { match: m.body.slice(at, at + q.length), rest: m.body.slice(at + q.length) } }];
    });
    return { chats, messages: found, accounts: people };
  }, [q, user, conversations, messages, accounts]);

  const data = tab === 'Messages' ? hits.messages : tab === 'Accounts' ? hits.accounts : [...hits.chats, ...hits.accounts, ...hits.messages];

  const open = (h: Hit) => {
    if (h.conversationId) {
      push(`/conversation/${h.conversationId}?username=${encodeURIComponent(h.user.username)}` as Href);
      return;
    }
    openDirect(h.user.id)
      .then((c) => push(`/conversation/${c.id}?username=${encodeURIComponent(h.user.username)}` as Href))
      .catch(() => {});
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ animation: 'fade' }} />
      <View style={styles.header}>
        <PressableScale onPress={() => back()} hitSlop={12} scaleTo={0.85} accessibilityLabel="Back" style={styles.back}>
          <Icon name="searchBack" width={13} height={23} />
        </PressableScale>
        <View style={styles.field}>
          <Icon name="searchFieldThin" width={13.75} height={13.75} style={styles.fieldIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find an account or a message..."
            placeholderTextColor={MUTED}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            selectionColor={colors.primary}
            cursorColor={colors.text}
            style={styles.input}
            accessibilityLabel="Search chats"
          />
          {query ? (
            <PressableScale onPress={() => setQuery('')} hitSlop={10} scaleTo={0.85} accessibilityLabel="Clear" style={styles.clear}>
              <Icon name="searchClear" width={16} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      {q ? (
        <>
          <Tabs tab={tab} onChange={setTab} />
          <FlatList
            data={data}
            keyExtractor={(h) => h.key}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 20, paddingBottom: insets.bottom + 24 }}
            ListEmptyComponent={
              loading ? null : (
                <Animated.View collapsable={false} entering={FadeIn.duration(180)} style={styles.empty}>
                  <Icon name="chatSearchEmpty" width={127} height={127} />
                  <Text style={styles.emptyText}>No account and no messages were found</Text>
                </Animated.View>
              )
            }
            renderItem={({ item }) => (
              <PressableScale onPress={() => open(item)} scaleTo={0.98} style={styles.row} accessibilityRole="button" accessibilityLabel={item.user.username}>
                {item.user.avatarUrl ? (
                  <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} transition={150} />
                ) : (
                  <Icon name="avatarPlaceholder" width={50} style={styles.avatar} />
                )}
                <View style={styles.names}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.kind === 'account' ? item.user.username : item.user.displayName || item.user.username}
                  </Text>
                  {typeof item.sub === 'string' ? (
                    <Text style={styles.sub} numberOfLines={1}>
                      {item.sub}
                    </Text>
                  ) : (
                    <Text style={styles.sub} numberOfLines={1}>
                      <Text style={styles.match}>“{item.sub.match}</Text>
                      {item.sub.rest.length > 12 ? `${item.sub.rest.slice(0, 12).trimEnd()}...` : item.sub.rest}”
                    </Text>
                  )}
                </View>
              </PressableScale>
            )}
          />
        </>
      ) : null}
    </View>
  );
}

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const [centres, setCentres] = useState<Partial<Record<Tab, number>>>({});
  const x = useSharedValue(-1);
  const centre = centres[tab];
  useEffect(() => {
    if (centre === undefined) return;
    const to = centre - UNDERLINE_W / 2;
    x.set(x.get() < 0 ? to : withTiming(to, { duration: 220 }));
  }, [centre, x]);
  const underline = useAnimatedStyle(() => ({ opacity: x.get() < 0 ? 0 : 1, transform: [{ translateX: Math.max(0, x.get()) }] }));
  const measure = (t: Tab) => (e: LayoutChangeEvent) => {
    const { x: left, width } = e.nativeEvent.layout;
    setCentres((c) => ({ ...c, [t]: left + width / 2 }));
  };
  return (
    <View style={styles.tabs}>
      {TABS.map((t) => (
        <PressableScale key={t} onPress={() => onChange(t)} hitSlop={10} scaleTo={0.95} onLayout={measure(t)} style={[styles.tab, { left: TAB_X[t] }]} accessibilityRole="tab">
          <Text style={[styles.tabText, t === tab && styles.tabActive]}>{t}</Text>
        </PressableScale>
      ))}
      <Animated.View style={[styles.underline, underline]} />
    </View>
  );
}

const TAB_X: Record<Tab, number> = { All: 16.2, Messages: 61, Accounts: 159.3 };

/** "1d", "3h", "5m", "2w". */
function shortAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d` : `${Math.round(d / 7)}w`;
}

// Design y − 47: field 44..375 at 6 (40 tall, #F5F5F5, radius 10); tabs' text box at 66.4; the rule and the 24px
// underline at 99; rows from 119.75, 75 apart: avatar 50 at x 11, name / sub Inter 13.4 at x 73.3.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: 52 },
  back: { position: 'absolute', left: 15.5, top: 15 },
  field: { position: 'absolute', left: 44, right: 15, top: 6, height: 40, borderRadius: 10, backgroundColor: '#F5F5F5' },
  fieldIcon: { position: 'absolute', left: 11.12, top: 13.38 },
  input: { position: 'absolute', left: 36.1, right: 34, top: 0, height: 40, padding: 0, fontFamily: INTER_FAMILIES['400'], fontSize: 15, color: colors.text },
  clear: { position: 'absolute', left: 306, top: 12 },
  tabs: { height: 47.75, borderBottomWidth: 0.75, borderBottomColor: LINE },
  tab: { position: 'absolute', top: 14.41 },
  tabText: { fontFamily: INTER_FAMILIES['500'], fontSize: 14, lineHeight: 17, color: MUTED },
  tabActive: { color: '#000000' },
  underline: { position: 'absolute', left: 0, bottom: -0.75, width: UNDERLINE_W, height: 0.75, backgroundColor: '#000000' },
  row: { height: 75, flexDirection: 'row', paddingLeft: 11, paddingRight: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.surfaceSoft },
  names: { flex: 1, marginLeft: 12.3, paddingTop: 7.06 },
  name: { fontFamily: INTER_FAMILIES['400'], fontSize: 13.4, lineHeight: 16, color: '#000000' },
  sub: { marginTop: 2.86, fontFamily: INTER_FAMILIES['400'], fontSize: 13.4, lineHeight: 16, color: MUTED },
  match: { color: '#000000' },
  // Circle 127 at (125.5, 203) and the line at 360.6 — both centred on x 189–191 in the design; centred here.
  empty: { alignItems: 'center', paddingTop: 36.25 },
  emptyText: { marginTop: 30.6, fontFamily: INTER_FAMILIES['400'], fontSize: 13.75, lineHeight: 17, color: colors.text },
});
