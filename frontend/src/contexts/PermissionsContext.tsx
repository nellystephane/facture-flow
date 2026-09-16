import { createContext, useState, useEffect, useContext, useCallback, type ReactNode } from 'react';
import * as subscriptionApi from '../api/subscription';
import type { Permissions } from '../types';
import { useAuth } from './AuthContext';

interface PermissionsContextValue {
  permissions: Permissions | null;
  loading: boolean;
  refresh: () => void;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!user) {
      setPermissions(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    subscriptionApi.getPermissions()
      .then((res) => setPermissions(res.data))
      .catch(() => setPermissions(null))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(refresh, [refresh, user?.subscription, user?.estPremium]);

  return (
    <PermissionsContext.Provider value={{ permissions, loading, refresh }}>
      {children}
    </PermissionsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions doit être utilisé dans un PermissionsProvider');
  return ctx;
};
