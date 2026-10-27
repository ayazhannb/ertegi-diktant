// Global user + settings state (React context).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, auth, getToken, setToken } from './api';
import type { User } from './types';
import { setMuted } from './lib/sound';

interface Ctx {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  login: (u: User, token: string) => void;
  logout: () => void;
  patchMe: (b: Record<string, unknown>) => Promise<void>;
  refresh: () => Promise<void>;
}

const UserCtx = createContext<Ctx>(null as unknown as Ctx);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try {
      const { user } = await auth.me();
      setUser(user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Apply settings to <html>
  useEffect(() => {
    const el = document.documentElement;
    const s = user?.settings || {};
    el.dataset.theme = s.theme === 'dark' ? 'dark' : 'light';
    el.dataset.textsize = s.textSize || 'md';
    el.dataset.dyslexia = s.dyslexia ? '1' : '0';
    setMuted(s.sound === false ? true : false);
  }, [user]);

  const value = useMemo<Ctx>(() => ({
    user, loading, setUser,
    login: (u, token) => { setToken(token); setUser(u); },
    logout: () => { setToken(null); setUser(null); location.href = '/login'; },
    patchMe: async (b) => {
      const { user: u } = await api.patch<{ user: User }>('/auth/me', b);
      setUser(u);
    },
    refresh,
  }), [user, loading, refresh]);

  return <UserCtx.Provider value={value}>{children}</UserCtx.Provider>;
}

export function useUser() {
  return useContext(UserCtx);
}
