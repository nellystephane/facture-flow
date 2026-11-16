import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import Layout from './components/Layout/Layout';
import Onboarding from './pages/Onboarding';
import Landing from './pages/Landing';
import SplashScreen from './components/SplashScreen';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import InvoiceForm from './pages/InvoiceForm';
import InvoiceDetail from './pages/InvoiceDetail';
import Clients from './pages/Clients';
import ClientForm from './pages/ClientForm';
import Services from './pages/Services';
import Quotes from './pages/Quotes';
import QuoteForm from './pages/QuoteForm';
import QuoteDetail from './pages/QuoteDetail';
import Payments from './pages/Payments';
import Profile from './pages/Profile';
import ConfirmPayout from './pages/ConfirmPayout';
import Abonnement from './pages/Abonnement';
import Equipe from './pages/Equipe';
import Support from './pages/Support';
import Affiliation from './pages/Affiliation';
import PaymentPublic from './pages/PaymentPublic';
import DevisPublic from './pages/DevisPublic';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import CGU from './pages/legal/CGU';
import Confidentialite from './pages/legal/Confidentialite';
import MentionsLegales from './pages/legal/MentionsLegales';
import PwaUpdatePrompt from './components/PwaUpdatePrompt';
import NetworkLoading from './components/NetworkLoading';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProtectedRoute from './pages/admin/AdminProtectedRoute';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  if (user) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function EntryPage() {
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
  if (!standalone) return <Landing />;
  const done = localStorage.getItem('oryxa_onboarding_v1') === 'done';
  return done ? <Navigate to="/login" replace /> : <Onboarding />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EntryPage />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/affiliation" element={<Affiliation />} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/verifier-email" element={<VerifyEmail />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
      <Route path="/cgu" element={<CGU />} />
      <Route path="/confidentialite" element={<Confidentialite />} />
      <Route path="/mentions-legales" element={<MentionsLegales />} />

      {/* Page de paiement publique — accessible au client sans compte */}
      <Route path="/payer/:token" element={<PaymentPublic />} />
      <Route path="/devis/:token" element={<DevisPublic />} />
      <Route path="/confirmer-retrait/:token" element={<ConfirmPayout />} />

      {/* Espace admin — auth totalement séparée des comptes utilisateurs,
          voir contexts/AdminAuthContext.tsx et docs/ADMIN_ACCESS.md */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/*" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />

      <Route path="/app" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/new" element={<InvoiceForm />} />
        <Route path="invoices/:id/edit" element={<InvoiceForm />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/new" element={<ClientForm />} />
        <Route path="clients/:id/edit" element={<ClientForm />} />
        <Route path="services" element={<Services />} />
        <Route path="quotes" element={<Quotes />} />
        <Route path="quotes/new" element={<QuoteForm />} />
        <Route path="quotes/:id/edit" element={<QuoteForm />} />
        <Route path="quotes/:id" element={<QuoteDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="profile" element={<Profile />} />
        <Route path="abonnement" element={<Abonnement />} />
        <Route path="equipe" element={<Equipe />} />
        <Route path="support" element={<Support />} />
        <Route path="affiliation" element={<Affiliation />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PermissionsProvider>
          <ToastProvider>
            <AdminAuthProvider>
              <AppRoutes />
              <PwaUpdatePrompt />
              <NetworkLoading />
            </AdminAuthProvider>
          </ToastProvider>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
