import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Search, Trash2, TrendingUp } from 'lucide-react';
import { getPayments, deletePayment } from '../api/payments';
import type { Payment } from '../types';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import StatCard from '../components/ui/StatCard';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import { formatFCFA, formatDate, METHODE_LABEL, apiError } from '../utils/format';

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    getPayments()
      .then((res) => setPayments(res.data))
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deletePayment(toDelete._id);
      toast('Paiement supprimé');
      setToDelete(null);
      load();
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setDeleting(false); }
  };

  const totalEncaisse = payments.reduce((s, p) => s + p.montant, 0);
  const filtered = payments.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const inv = typeof p.invoice === 'object' ? p.invoice : null;
    const client = typeof inv?.client === 'object' ? inv?.client : null;
    return (client?.nom || '').toLowerCase().includes(q) || METHODE_LABEL[p.methode].toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Paiements"
        subtitle={`${payments.length} paiement(s) enregistré(s)`}
        icon={<Wallet size={20} />}
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total encaissé" value={formatFCFA(totalEncaisse)} icon={<TrendingUp size={22} />} accent="vert" />
        <StatCard label="Nombre de paiements" value={payments.length} icon={<Wallet size={22} />} accent="rouge" />
        <StatCard label="Moyen de paiement fréquent" value={payments.length ? METHODE_LABEL[mostFrequent(payments)] : '—'} icon={<Wallet size={22} />} accent="noir" />
      </div>

      <div className="glass-card p-4 mb-6 animate-fade-up">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="field pl-10" placeholder="Rechercher par client, moyen, référence..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-6">{[...Array(4)].map((_, i) => <div key={i} className="h-14 skeleton mb-2" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Wallet size={28} />}
          title="Aucun paiement"
          description="Les paiements sont enregistrés depuis le détail d'une facture."
          action={<Link to="/app/invoices" className="btn-primary">Voir mes factures</Link>}
        />
      ) : (
        <div className="glass-card overflow-hidden animate-fade-up">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100 bg-white/40">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Client / Facture</th>
                  <th className="px-5 py-3 font-semibold">Moyen</th>
                  <th className="px-5 py-3 font-semibold">Référence</th>
                  <th className="px-5 py-3 font-semibold text-right">Montant</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => {
                  const inv = typeof p.invoice === 'object' ? p.invoice : null;
                  const client = typeof inv?.client === 'object' ? inv?.client : null;
                  return (
                    <tr key={p._id} className="hover:bg-white/50 transition-soft">
                      <td className="px-5 py-4 text-gray-500">{formatDate(p.date)}</td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-[#0a0a0c]">{client?.nom || '—'}</p>
                        {inv && <Link to={`/app/invoices/${inv._id}`} className="text-xs text-[#d9524d] hover:underline">{inv.numero}</Link>}
                      </td>
                      <td className="px-5 py-4"><span className="badge badge-payee">{METHODE_LABEL[p.methode]}</span></td>
                      <td className="px-5 py-4 text-gray-500">{p.reference || '—'}</td>
                      <td className="px-5 py-4 text-right font-bold text-green-600">{formatFCFA(p.montant)}</td>
                      <td className="px-5 py-4 text-right">
                        <button className="btn-icon" onClick={() => setToDelete(p)}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete} title="Supprimer le paiement"
        message={`Supprimer ce paiement de ${formatFCFA(toDelete?.montant)} ?`}
        confirmLabel="Supprimer" onConfirm={handleDelete} onClose={() => setToDelete(null)} loading={deleting}
      />
    </div>
  );
}

// Helper pour trouver le moyen de paiement le plus fréquent
function mostFrequent(payments: Payment[]): Payment['methode'] {
  const counts: Record<string, number> = {};
  payments.forEach((p) => { counts[p.methode] = (counts[p.methode] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as Payment['methode'];
}
