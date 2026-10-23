import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { logout, restoreSession } from '@/lib/auth';
import { setSessionExpiredHandler } from '@/lib/api';
import { CAPTURE, captureParam } from '@/lib/capture';
import { closeChatSocket } from '@/lib/chat';

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  avatarUri: string | null;
  interests: string[];
};

export type SignupDraft = {
  name: string;
  username: string;
  password: string;
  avatarUri: string | null;
  interests: string[];
  /** "I'm 13 or older" ticked on the first step; the backend refuses the signup without it. */
  ageConfirmed: boolean;
  /** E.164, or '' when skipped. */
  phone: string;
  /** The university address and the server's proof of it (from the code step). */
  email: string;
  emailToken: string;
};

const emptyDraft: SignupDraft = {
  name: '',
  username: '',
  password: '',
  avatarUri: null,
  interests: [],
  ageConfirmed: false,
  phone: '',
  email: '',
  emailToken: '',
};

type SessionContextValue = {
  user: SessionUser | null;
  /** False until the stored session has been checked on app start. */
  ready: boolean;
  draft: SignupDraft;
  updateDraft: (patch: Partial<SignupDraft>) => void;
  resetDraft: (patch?: Partial<SignupDraft>) => void;
  signIn: (user: SessionUser) => void;
  /** Applies profile edits (name, avatar) to the signed-in user. */
  updateUser: (patch: Partial<SessionUser>) => void;
  signOut: () => void;
};

const CAPTURE_USER: SessionUser = { id: 'capture', name: 'Oleg Tinkov', username: 'oleg_tinkov', avatarUri: null, interests: [] };

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(CAPTURE ? CAPTURE_USER : null);
  const [ready, setReady] = useState(CAPTURE);

  useEffect(() => {
    if (CAPTURE) return;
    restoreSession()
      .then((u) => u && setUser(u))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  const [draft, setDraft] = useState<SignupDraft>(() => ({ ...emptyDraft, ...JSON.parse(captureParam('draft') ?? '{}') }));

  // The refresh token was rejected: drop the in-memory user so the app returns to sign-in.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      closeChatSocket();
      setUser(null);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const updateDraft = useCallback((patch: Partial<SignupDraft>) => setDraft((d) => ({ ...d, ...patch })), []);
  const resetDraft = useCallback((patch?: Partial<SignupDraft>) => setDraft({ ...emptyDraft, ...patch }), []);
  const signIn = useCallback((u: SessionUser) => setUser(u), []);
  const updateUser = useCallback((patch: Partial<SessionUser>) => setUser((u) => (u ? { ...u, ...patch } : u)), []);
  const signOut = useCallback(() => {
    setUser(null);
    closeChatSocket();
    logout();
  }, []);

  const value = useMemo(
    () => ({ user, ready, draft, updateDraft, resetDraft, signIn, updateUser, signOut }),
    [user, ready, draft, updateDraft, resetDraft, signIn, updateUser, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
