import { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import api from '../api/axiosConfig';
import { clearAccessToken, setAccessToken } from '../api/tokenStore';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: authApi.RegisterData) => Promise<User | null>;
  logout: () => void;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let actif = true;
    const restaurerSession = async () => {
      try {
        // Le refresh token est uniquement dans un cookie httpOnly. Il n'est
        // jamais accessible à JavaScript ni stocké dans localStorage.
        const res = await api.post<{ token: string; user: User }>('/auth/refresh', {});
        if (!actif) return;
        setAccessToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('oryxa_user', JSON.stringify(res.data.user));
      } catch {
        clearAccessToken();
        if (actif) {
          setUser(null);
          localStorage.removeItem('oryxa_user');
        }
      } finally {
        if (actif) setLoading(false);
      }
    };
    restaurerSession();
    return () => { actif = false; };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setAccessToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('oryxa_user', JSON.stringify(res.data.user));
    return res.data.user;
  };

  const register = async (data: authApi.RegisterData) => {
    const res = await authApi.register(data);
    if (res.data.needsVerification || !res.data.token) return null;
    setAccessToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('oryxa_user', JSON.stringify(res.data.user));
    return res.data.user;
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => undefined);
    clearAccessToken();
    localStorage.removeItem('oryxa_user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
};
