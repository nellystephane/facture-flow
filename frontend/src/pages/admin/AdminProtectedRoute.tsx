import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import SplashScreen from '../../components/SplashScreen';

export default function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { adminEmail, loading } = useAdminAuth();
  if (loading) return <SplashScreen />;
  if (!adminEmail) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}
