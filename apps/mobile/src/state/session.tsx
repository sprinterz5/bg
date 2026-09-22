import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  avatarUri: string | null;
  interests: string[];
};

export type SignupDraft = {
  provider: 'google' | 'apple' | null;
  name: string;
  username: string;
  password: string;
  avatarUri: string | null;
  interests: string[];
};

const emptyDraft: SignupDraft = {
  provider: null,
  name: '',
  username: '',
  password: '',
  avatarUri: null,
  interests: [],
};

type SessionContextValue = {
  user: SessionUser | null;
  draft: SignupDraft;
  updateDraft: (patch: Partial<SignupDraft>) => void;
  resetDraft: (patch?: Partial<SignupDraft>) => void;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [draft, setDraft] = useState<SignupDraft>(emptyDraft);

  const updateDraft = useCallback((patch: Partial<SignupDraft>) => setDraft((d) => ({ ...d, ...patch })), []);
  const resetDraft = useCallback((patch?: Partial<SignupDraft>) => setDraft({ ...emptyDraft, ...patch }), []);
  const signIn = useCallback((u: SessionUser) => setUser(u), []);
  const signOut = useCallback(() => setUser(null), []);

  const value = useMemo(
    () => ({ user, draft, updateDraft, resetDraft, signIn, signOut }),
    [user, draft, updateDraft, resetDraft, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
