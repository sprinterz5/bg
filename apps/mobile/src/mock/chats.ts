import type { Conversation } from '@/lib/chat';

// AutoLayouted 18 as data, for the web design check (lib/capture): the signed-in mock user is 'capture'.
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function chat(id: string, name: string, last: { mine: boolean; body: string; at: number }, opts: { unread?: number; seenAt?: number } = {}): Conversation {
  const other = { id: `u-${id}`, username: name.toLowerCase().replace(/\s+/g, '_'), displayName: name, avatarUrl: null };
  return {
    id,
    updatedAt: ago(last.at),
    unreadCount: opts.unread ?? 0,
    members: [
      { userId: 'capture', lastReadAt: ago(0), user: { id: 'capture', username: 'oleg_tinkov', displayName: 'Oleg Tinkov', avatarUrl: null } },
      { userId: other.id, lastReadAt: opts.seenAt !== undefined ? ago(opts.seenAt) : null, user: other },
    ],
    messages: [{ id: `m-${id}`, conversationId: id, senderId: last.mine ? 'capture' : other.id, body: last.body, createdAt: ago(last.at) }],
  };
}

export const CAPTURE_CHATS: Conversation[] = [
  chat('c1', 'priv.acc', { mine: false, body: 'Who are you?', at: 5 }, { unread: 3 }),
  chat('c2', 'Steve Jobs', { mine: true, body: 'ok', at: 90 }, { seenAt: 60 }),
  chat('c3', 'Michael Branto', { mine: false, body: 'whats wrong?', at: 120 }),
  chat('c4', 'Aangus', { mine: true, body: 'see you', at: 200 }, { seenAt: 190 }),
  chat('c5', 'Kanie', { mine: true, body: 'hey', at: 60 * 24 }),
  chat('c6', 'Miss Anara', { mine: false, body: 'don`t know, but people say it is the best one', at: 60 * 24 }),
  chat('c7', 'stevie.p', { mine: false, body: 'shared an article', at: 60 * 48 }),
  chat('c8', 'mason_thames', { mine: true, body: 'thanks', at: 60 * 80 }, { seenAt: 60 * 72 }),
];
