import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

export default function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { adminEmail } = useAdminAuth();
  // Pas de vérification serveur ici : si le token stocké est expiré/invalide,
  // le premier appel API échoue avec 401/403 et adminAxios.ts redirige déjà
  // vers /admin/login (voir interceptors.response).
  if (!adminEmail) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}
