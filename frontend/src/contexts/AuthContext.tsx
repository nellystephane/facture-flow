import { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  // Renvoie l'utilisateur connecté directement (compte déjà vérifié — cas
  // legacy) ou `null` si un code de confirmation vient d'être envoyé et que
  // l'inscription n'est pas encore terminée.
  register: (data: authApi.RegisterData) => Promise<User | null>;
  logout: () => void;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) localStorage.setItem('oryxa_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    let actif = true;

    const chargerProfil = async (tentative = 0): Promise<void> => {
      try {
        const res = await authApi.getProfile();
        if (actif) { setUser(res.data); localStorage.setItem('oryxa_user', JSON.stringify(res.data)); }
      } catch (err: any) {
        const status = err?.response?.status;
        const timeoutOuReseau = !err?.response || err?.code === 'ECONNABORTED' || err?.code === 'ERR_NETWORK';

        // Un démarrage à froid du backend (Render, par exemple) ou une
        // connexion mobile instable ne doit pas détruire une session valide.
        // On retente deux fois avant d'abandonner. Seul un 401/403 invalide
        // réellement le token.
        if (timeoutOuReseau && tentative < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1200 * (tentative + 1)));
          if (actif) return chargerProfil(tentative + 1);
          return;
        }

        if (status === 401) {
          localStorage.removeItem('token');
          if (actif) setUser(null);
          localStorage.removeItem('oryxa_user');
        }
        // Pour une panne réseau persistante, on conserve le token : les
        // prochains appels pourront fonctionner dès que le serveur revient.
        if (actif) setLoading(false);
        return;
      }
    };

    chargerProfil().finally(() => {
      if (actif) setLoading(false);
    });

    return () => {
      actif = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    localStorage.setItem('oryxa_user', JSON.stringify(res.data.user));
    return res.data.user;
  };

  const register = async (data: authApi.RegisterData) => {
    const res = await authApi.register(data);
    // Nouveau parcours : pas de token tant que le code de confirmation par
    // email n'a pas été saisi (voir VerifyEmail.tsx).
    if (res.data.needsVerification || !res.data.token) return null;
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    localStorage.setItem('oryxa_user', JSON.stringify(res.data.user));
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('oryxa_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
};
