import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Users, Package, FileSpreadsheet,
  Wallet, User, LogOut, X, Zap, Crown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const NAV = [
  { to: '/app', end: true, label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/app/invoices', label: 'Factures', icon: FileText },
  { to: '/app/quotes', label: 'Devis', icon: FileSpreadsheet },
  { to: '/app/clients', label: 'Clients', icon: Users },
  { to: '/app/services', label: 'Produits & Services', icon: Package },
  { to: '/app/payments', label: 'Paiements', icon: Wallet },
  { to: '/app/abonnement', label: 'Abonnement', icon: Crown },
  { to: '/app/profile', label: 'Mon profil', icon: User },
];

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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
        <div className="glass-card h-full p-5 flex flex-col">
          {/* Logo */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg,#d9524d,#b23c37)' }}
              >
                <Zap size={20} fill="white" />
              </div>
              <div>
                <p className="font-extrabold text-lg text-[#0a0a0c] leading-none">FactuFlow</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Gestion Pro</p>
              </div>
            </div>
            <button className="btn-icon lg:hidden" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
            {NAV.map(({ to, end, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-soft ${
                    isActive
                      ? 'text-white shadow-md'
                      : 'text-gray-600 hover:text-[#0a0a0c] hover:bg-white/60'
                  }`
                }
                style={({ isActive }) =>
                  isActive ? { background: 'linear-gradient(135deg,#d9524d,#b23c37)' } : undefined
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Carte upgrade */}
          <div
            className="rounded-2xl p-4 mt-4 text-white"
            style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}
          >
            <p className="text-xs font-bold mb-1 flex items-center gap-1.5">
              <Zap size={14} className="text-[#f4847d]" /> Plan {user?.subscription || 'gratuit'}
            </p>
            <p className="text-[11px] text-gray-300 mb-3 leading-relaxed">
              Passez au plan Pro pour des factures illimitées et les relances auto.
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
