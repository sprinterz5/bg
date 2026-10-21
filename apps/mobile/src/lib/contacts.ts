import type { ApiConnection } from '@api/api';
import { Contact, ContactField, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { CONTACTS, type Author } from '@/mock/data';
import { api } from './api';
import { CAPTURE } from './capture';
import { toE164 } from './phone';

export type ContactPerson = Author & { id: string | null };
/** ask: not asked yet (the block offers it); hidden: refused, no one found or no contacts API (web). */
export type ContactsState = { status: 'loading' | 'ask' | 'hidden' | 'ready'; people: ContactPerson[] };

// Once per app run: the block is recycled with the feed and must not re-read the address book every time.
let state: ContactsState = CAPTURE
  ? { status: 'ready', people: CONTACTS.map((a) => ({ ...a, id: null })) }
  : { status: 'loading', people: [] };
let started = false;
const listeners = new Set<(s: ContactsState) => void>();
const set = (s: ContactsState) => {
  state = s;
  listeners.forEach((l) => l(s));
};

async function match() {
  const contacts = await Contact.getAllDetails([ContactField.PHONES]);
  const phones = new Set<string>();
  for (const c of contacts) for (const p of c.phones ?? []) {
    const e164 = p.number ? toE164(p.number) : null;
    if (e164) phones.add(e164);
  }
  // Only the numbers go out; the backend matches them against accounts and keeps nothing.
  const found = phones.size
    ? await api<{ data: ApiConnection[] }>('/users/contacts/match', { method: 'POST', body: { phones: [...phones].slice(0, 5000) }, auth: true })
    : { data: [] };
  const people = found.data.map((u) => ({ id: u.id, username: u.username, name: u.displayName ?? undefined, avatar: u.avatarUrl ? { uri: u.avatarUrl } : null, subtitle: '' }));
  set({ status: people.length ? 'ready' : 'hidden', people });
}

async function start() {
  if (started || CAPTURE) return;
  started = true;
  if (Platform.OS === 'web') return set({ status: 'hidden', people: [] });
  try {
    const perm = await getPermissionsAsync();
    if (perm.granted) await match();
    else set({ status: perm.canAskAgain ? 'ask' : 'hidden', people: [] });
  } catch {
    set({ status: 'hidden', people: [] });
  }
}

/** The "Allow" in the block: the system prompt, then the matching. */
export async function allowContacts() {
  try {
    const perm = await requestPermissionsAsync();
    if (!perm.granted) return set({ status: 'hidden', people: [] });
    set({ status: 'loading', people: [] });
    await match();
  } catch {
    set({ status: 'hidden', people: [] });
  }
}

export function useContacts() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    start();
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
