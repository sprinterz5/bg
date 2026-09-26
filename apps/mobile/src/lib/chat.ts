import { io, type Socket } from 'socket.io-client';

import { api, API_URL, getAccessToken, refreshSession } from './api';

export type ChatUser = { id: string; username: string; displayName: string | null; avatarUrl: string | null };

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: string;
};

export type Conversation = {
  id: string;
  updatedAt: string;
  members: { userId: string; lastReadAt: string | null; user: ChatUser }[];
  messages: ChatMessage[];
};

type Page<T> = { data: T[]; nextCursor: string | null };

export const fetchConversations = () => api<Conversation[]>('/conversations', { auth: true });

/** Existing direct chat with this user, or a new one. */
export const openDirect = (userId: string) =>
  api<Conversation>('/conversations/direct', { body: { userId }, auth: true });

/** Newest first. */
export const fetchMessages = (conversationId: string, cursor?: string) =>
  api<Page<ChatMessage>>(`/conversations/${conversationId}/messages?limit=50${cursor ? `&cursor=${cursor}` : ''}`, {
    auth: true,
  });

export const sendMessage = (conversationId: string, body: string) =>
  api<ChatMessage>(`/conversations/${conversationId}/messages`, { body: { type: 'TEXT', body }, auth: true });

export const markRead = (conversationId: string) =>
  api(`/conversations/${conversationId}/read`, { method: 'POST', auth: true }).catch(() => {});

export const otherMember = (c: Conversation, meId: string) => c.members.find((m) => m.userId !== meId)?.user ?? null;

// One shared Socket.IO connection. The server sits behind the /api prefix on the VPS, so the path follows API_URL.
let socket: Socket | null = null;

export function chatSocket() {
  if (socket) return socket;
  const [, origin, prefix = ''] = API_URL.match(/^(https?:\/\/[^/]+)(\/.*?)?\/?$/) ?? [];
  socket = io(origin, {
    path: `${prefix}/socket.io`,
    transports: ['websocket'],
    auth: (cb) => cb({ token: getAccessToken() }),
  });
  // Access tokens are short-lived: refresh once and let the client reconnect with the new one.
  socket.on('connect_error', async (err) => {
    if (err.message !== 'Invalid token' && err.message !== 'Authentication required') return;
    if (await refreshSession()) socket?.connect();
  });
  return socket;
}

export function closeChatSocket() {
  socket?.disconnect();
  socket = null;
}
