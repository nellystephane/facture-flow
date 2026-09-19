import { createContext, useContext, useState, type ReactNode } from 'react';
import adminApi, { ADMIN_TOKEN_KEY } from '../api/adminAxios';

interface AdminAuthValue {
  adminEmail: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminEmail, setAdminEmail] = useState<string | null>(
    localStorage.getItem('oryxa_admin_email')
  );

  const login = async (email: string, password: string) => {
    const res = await adminApi.post('/admin/login', { email, password });
    localStorage.setItem(ADMIN_TOKEN_KEY, res.data.token);
    localStorage.setItem('oryxa_admin_email', res.data.email);
    setAdminEmail(res.data.email);
  };

  const logout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem('oryxa_admin_email');
    setAdminEmail(null);
  };

  return (
    <AdminAuthContext.Provider value={{ adminEmail, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth doit être utilisé dans un AdminAuthProvider');
  return ctx;
}
