import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import adminApi from '../api/adminAxios';
import { clearAdminAccessToken, setAdminAccessToken } from '../api/adminTokenStore';

interface AdminAuthValue {
  adminEmail: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let actif = true;
    adminApi.post<{ token: string; email: string }>('/admin/refresh', {})
      .then((res) => {
        if (!actif) return;
        setAdminAccessToken(res.data.token);
        setAdminEmail(res.data.email);
      })
      .catch(() => {
        clearAdminAccessToken();
        if (actif) setAdminEmail(null);
      })
      .finally(() => { if (actif) setLoading(false); });
    return () => { actif = false; };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await adminApi.post('/admin/login', { email, password });
    setAdminAccessToken(res.data.token);
    setAdminEmail(res.data.email);
  };

  const logout = () => {
    adminApi.post('/admin/logout').catch(() => undefined);
    clearAdminAccessToken();
    setAdminEmail(null);
  };

  return <AdminAuthContext.Provider value={{ adminEmail, loading, login, logout }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth doit être utilisé dans un AdminAuthProvider');
  return ctx;
}
