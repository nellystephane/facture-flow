import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Clock, AlertTriangle, Users,
  Wallet, FileText, ArrowRight, Plus
} from 'lucide-react';
import { getDashboard } from '../api/stats';
import type { DashboardData } from '../types';
import { formatFCFA, formatCompact, badgeClass, INVOICE_STATUT_LABEL } from '../utils/format';
import StatCard from '../components/ui/StatCard';
import PageHeader from '../components/ui/PageHeader';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const maxRevenu = data ? Math.max(...data.revenusMensuels.map((r) => r.total), 1) : 1;
  const maxClient = data ? Math.max(...data.topClients.map((c) => c.total), 1) : 1;

  if (loading) {
    return (
      <div>
        <div className="h-8 w-64 skeleton mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton" />)}
        </div>
        <div className="h-80 skeleton" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble de votre activité"
        icon={<LayoutDashboard size={20} />}
        actions={
          <Link to="/app/invoices/new" className="btn-primary text-sm">
            <Plus size={18} /> Nouvelle facture
          </Link>
        }
      />

      {/* Stats principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Chiffre d'affaires" value={formatCompact(data?.chiffreAffaires)} icon={<TrendingUp size={22} />} accent="vert" delay={0} />
        <StatCard label="En attente" value={formatCompact(data?.enAttente)} icon={<Clock size={22} />} accent="bleu" delay={0.08} />
        <StatCard label="En retard" value={formatCompact(data?.enRetard)} icon={<AlertTriangle size={22} />} accent="rouge" delay={0.16} />
        <StatCard label="Clients" value={data?.totalClients ?? 0} icon={<Users size={22} />} accent="noir" delay={0.24} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Graphique revenus */}
        <div className="glass-card p-6 lg:col-span-2 animate-fade-up delay-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-[#0a0a0c]">Revenus mensuels</h3>
              <p className="text-xs text-gray-500">6 derniers mois</p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg,#d9524d,#b23c37)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 sm:gap-4 h-56">
            {data?.revenusMensuels.map((r, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="relative w-full flex items-end justify-center" style={{ height: '200px' }}>
                  <div
                    className="w-full max-w-[42px] rounded-t-lg transition-soft group-hover:opacity-90 relative"
                    style={{
                      height: `${Math.max((r.total / maxRevenu) * 100, 3)}%`,
                      background: r.total === maxRevenu && maxRevenu > 0
                        ? 'linear-gradient(180deg,#d9524d,#b23c37)'
                        : 'linear-gradient(180deg,#1a1a1f,#0a0a0c)'
                    }}
                  >
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#0a0a0c] opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                      {formatCompact(r.total)}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-gray-500 capitalize">{r.mois}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top clients */}
        <div className="glass-card p-6 animate-fade-up delay-3">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-[#0a0a0c]">Top clients</h3>
            <Users size={18} className="text-gray-400" />
          </div>
          {data?.topClients.length ? (
            <div className="space-y-4">
              {data.topClients.map((c, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-[#0a0a0c] truncate">{c.nom}</span>
                    <span className="text-gray-500 text-xs">{formatCompact(c.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-soft"
                      style={{ width: `${(c.total / maxClient) * 100}%`, background: 'linear-gradient(90deg,#d9524d,#b23c37)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Aucun client pour le moment</p>
          )}
        </div>
      </div>

      {/* Factures récentes + raccourcis */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 lg:col-span-2 animate-fade-up delay-4">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-[#0a0a0c]">Dernières factures</h3>
            <Link to="/app/invoices" className="text-sm font-semibold text-[#d9524d] hover:underline flex items-center gap-1">
              Voir tout <ArrowRight size={14} />
            </Link>
          </div>
          {data?.facturesRecentes.length ? (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="px-2 pb-3 font-semibold">N°</th>
                    <th className="px-2 pb-3 font-semibold">Client</th>
                    <th className="px-2 pb-3 font-semibold">Montant</th>
                    <th className="px-2 pb-3 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.facturesRecentes.map((inv) => {
                    const client = typeof inv.client === 'object' ? inv.client : null;
                    return (
                      <tr key={inv._id} className="hover:bg-white/40 transition-soft">
                        <td className="px-2 py-3">
                          <Link to={`/app/invoices/${inv._id}`} className="font-semibold text-[#0a0a0c] hover:text-[#d9524d]">
                            {inv.numero}
                          </Link>
                        </td>
                        <td className="px-2 py-3 text-gray-600">{client?.nom || '—'}</td>
                        <td className="px-2 py-3 font-medium">{formatFCFA(inv.totalTTC)}</td>
                        <td className="px-2 py-3"><span className={badgeClass(inv.statut)}>{INVOICE_STATUT_LABEL[inv.statut]}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10">
              <FileText size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-4">Aucune facture encore. Créez votre première !</p>
              <Link to="/app/invoices/new" className="btn-primary text-sm"><Plus size={16} /> Nouvelle facture</Link>
            </div>
          )}
        </div>

        {/* Raccourcis */}
        <div className="space-y-4">
          <div className="glass-card p-6 animate-fade-up delay-5">
            <h3 className="font-bold text-[#0a0a0c] mb-4">Actions rapides</h3>
            <div className="space-y-2">
              {[
                { to: '/app/invoices/new', label: 'Créer une facture', icon: FileText },
                { to: '/app/quotes/new', label: 'Créer un devis', icon: FileText },
                { to: '/app/clients/new', label: 'Ajouter un client', icon: Users },
                { to: '/app/services', label: 'Gérer les services', icon: Wallet },
              ].map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/70 hover:text-[#d9524d] transition-soft">
                  <Icon size={16} /> {label}
                  <ArrowRight size={14} className="ml-auto" />
                </Link>
              ))}
            </div>
          </div>

          <div className="glass-card p-6 animate-fade-up delay-5"
            style={{ background: 'linear-gradient(135deg, rgba(225,29,42,0.08), rgba(10,10,12,0.04))' }}>
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={18} className="text-[#d9524d]" />
              <h3 className="font-bold text-[#0a0a0c]">Total encaissé</h3>
            </div>
            <p className="text-2xl font-extrabold text-[#0a0a0c]">{formatFCFA(data?.totalPaye)}</p>
            <p className="text-xs text-gray-500 mt-1">Sur {data?.totalFactures || 0} facture(s)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
