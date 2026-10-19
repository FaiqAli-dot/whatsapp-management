import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearCsrf } from './api';

export type User = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  businessId: string | null;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: User }>('/api/v1/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = async () => {
    try {
      await api('/api/v1/auth/logout', { method: 'POST', json: {} });
    } finally {
      clearCsrf();
      setUser(null);
    }
  };

  return (
    <Ctx.Provider value={{ user, loading, refresh, logout, setUser }}>{children}</Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('AuthProvider missing');
  return ctx;
}
