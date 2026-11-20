import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Users, Package, FileSpreadsheet,
  Wallet, Receipt, ShoppingCart, Repeat, User, LogOut, X, Crown, UsersRound, Headphones, Zap, Gift
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import ThemeToggle from '../ThemeToggle';
import OryxaLogo from '../OryxaLogo';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

interface NavEntry { to: string; end?: boolean; label: string; icon: typeof LayoutDashboard }
interface NavGroup { title: string | null; items: NavEntry[] }

// Regroupé par intention : ce que je vends, à qui, ce que j'encaisse, mon compte.
const GROUPS: NavGroup[] = [
  { title: null, items: [{ to: '/app', end: true, label: 'Tableau de bord', icon: LayoutDashboard }] },
  { title: 'Vendre', items: [
    { to: '/app/invoices', label: 'Factures', icon: FileText },
    { to: '/app/quotes', label: 'Devis', icon: FileSpreadsheet },
    { to: '/app/vente-rapide', label: 'Vente comptoir', icon: ShoppingCart },
    { to: '/app/recurrentes', label: 'Récurrentes', icon: Repeat },
  ] },
  { title: 'Catalogue', items: [
    { to: '/app/clients', label: 'Clients', icon: Users },
    { to: '/app/services', label: 'Produits & Services', icon: Package },
  ] },
  { title: 'Argent', items: [
    { to: '/app/payments', label: 'Paiements', icon: Wallet },
    { to: '/app/depenses', label: 'Dépenses', icon: Receipt },
  ] },
  { title: 'Compte', items: [
    { to: '/app/abonnement', label: 'Abonnement', icon: Crown },
    { to: '/app/profile', label: 'Mon profil', icon: User },
    { to: '/app/affiliation', label: 'Affiliation', icon: Gift },
    { to: '/app/support', label: 'Support', icon: Headphones },
  ] },
];

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { permissions } = usePermissions();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // "Équipe" n'apparaît que pour les comptes Business avec un rôle
  // propriétaire/admin — un collaborateur ou un compte Gratuit/Pro n'a pas
  // à voir un lien vers une page qui lui répondrait "verrouillé" ou "accès
  // refusé" à chaque clic.
  const groups = permissions?.peutGererEquipe
    ? GROUPS.map((g) => (g.title === 'Compte'
        ? { ...g, items: [{ to: '/app/equipe', label: 'Équipe', icon: UsersRound }, ...g.items] }
        : g))
    : GROUPS;

  return (
    <>
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden animate-fade-in"
          style={{ background: 'rgba(10,10,12,0.5)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-72 p-4 transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="glass-card side-glass h-full p-5 flex flex-col">
          {/* Logo */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2.5">
              <OryxaLogo size={40} nameClassName="font-extrabold text-lg text-[#0a0a0c] dark:text-white leading-none" imageClassName="rounded-xl shadow-lg" />
              <span className="sr-only">Gestion Pro</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <button className="btn-icon lg:hidden" onClick={onClose}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 flex flex-col overflow-y-auto pr-1 -mr-1" aria-label="Navigation principale">
            {groups.map((g) => (
              <div key={g.title ?? 'top'} className="flex flex-col gap-0.5">
                {g.title && <p className="nav-group-label">{g.title}</p>}
                {g.items.map(({ to, end, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `nav-item flex items-center gap-3 px-3.5 py-2 rounded-xl font-medium text-sm transition-soft ${
                        isActive
                          ? 'is-active'
                          : 'text-gray-600 dark:text-gray-400 hover:text-[#0a0a0c] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10'
                      }`
                    }
                  >
                    <Icon size={17} className="nav-ico" />
                    {label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* Carte upgrade — masquée si déjà Pro/Business actif */}
          {permissions && permissions.plan === 'gratuit' && (
            <div
              className="rounded-2xl p-4 mt-4 text-white"
              style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}
            >
              <p className="text-xs font-bold mb-1 flex items-center gap-1.5">
                <Zap size={14} className="text-[#f4847d]" /> Plan Gratuit
              </p>
              <p className="text-[11px] text-gray-300 dark:text-gray-600 mb-3 leading-relaxed">
                Passez au plan Pro pour des factures illimitées, la facturation express et le logo personnalisé.
              </p>
              <NavLink
                to="/app/abonnement"
                onClick={onClose}
                className="block text-center text-xs font-semibold py-2 rounded-lg transition-soft"
                style={{ background: 'linear-gradient(135deg,#d9524d,#b23c37)' }}
              >
                Améliorer →
              </NavLink>
            </div>
          )}

          {/* User + logout */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ background: 'linear-gradient(135deg,#d9524d,#b23c37)' }}
              >
                {user?.nom?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0a0a0c] truncate">{user?.nom}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold text-[#d9524d] bg-[rgba(225,29,42,0.08)] hover:bg-[rgba(225,29,42,0.15)] transition-soft"
            >
              <LogOut size={16} /> Déconnexion
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
