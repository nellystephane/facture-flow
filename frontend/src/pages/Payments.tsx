import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Search, Trash2, TrendingUp, Receipt } from 'lucide-react';
import { getPayments, getPaymentsStats, deletePayment, paymentReceiptUrl, type PaymentsStats } from '../api/payments';
import type { Payment } from '../types';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import StatCard from '../components/ui/StatCard';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PdfPreviewModal from '../components/PdfPreviewModal';
import Pagination from '../components/ui/Pagination';
import { useToast } from '../contexts/ToastContext';
import { formatFCFA, formatDate, METHODE_LABEL, apiError } from '../utils/format';
import { getPayoutSummary, requestPayout } from '../api/payouts';

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [toDelete, setToDelete] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [soldeRetirable, setSoldeRetirable] = useState(0);
  const [payoutEnCours, setPayoutEnCours] = useState(false);
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    getPayments({ q: search || undefined, page })
      .then((res) => {
        setPayments(res.data.items);
        setTotalPages(res.data.totalPages);
        setTotal(res.data.total);
      })
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  };

  const loadStats = () => {
    getPaymentsStats().then((res) => setStats(res.data)).catch(() => {});
  };

  useEffect(load, [page]);
  useEffect(loadStats, []);
  useEffect(() => { getPayoutSummary().then((res) => setSoldeRetirable(res.data.soldeRetirable || 0)).catch(() => {}); }, []);

  // Recherche : retour en page 1 + légère pause pour ne pas spammer l'API.
  useEffect(() => {
    const t = setTimeout(() => { if (page !== 1) setPage(1); else load(); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deletePayment(toDelete._id);
      toast('Paiement supprimé');
      setToDelete(null);
      load();
      loadStats();
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <PageHeader
        title="Paiements"
        subtitle={`${total} paiement(s) enregistré(s)`}
        icon={<Wallet size={20} />}
      />

      <div className="glass-card p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Solde retirable</p><p className="text-3xl font-extrabold text-[#0a0a0c] dark:text-white">{formatFCFA(soldeRetirable)}</p><p className="text-xs text-gray-500 mt-1">Montant actuellement disponible pour un reversement.</p></div>
        <button className="btn-primary" disabled={payoutEnCours || soldeRetirable <= 0} onClick={async () => { setPayoutEnCours(true); try { const res = await requestPayout(); toast(`Reversement créé : ${formatFCFA(res.data.montant)}`); const s = await getPayoutSummary(); setSoldeRetirable(s.data.soldeRetirable || 0); } catch (err) { toast(apiError(err), 'error'); } finally { setPayoutEnCours(false); } }}>{payoutEnCours ? 'Création…' : 'Demander le reversement'}</button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total encaissé" value={formatFCFA(stats?.totalEncaisse || 0)} icon={<TrendingUp size={22} />} accent="vert" />
        <StatCard label="Nombre de paiements" value={stats?.nombrePaiements || 0} icon={<Wallet size={22} />} accent="rouge" />
        <StatCard
          label="Moyen de paiement fréquent"
          value={stats?.methodePlusFrequente ? METHODE_LABEL[stats.methodePlusFrequente] : '—'}
          icon={<Wallet size={22} />} accent="noir"
        />
      </div>

      <div className="glass-card p-4 mb-6 animate-fade-up">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input className="field pl-10" placeholder="Rechercher par client, N° facture, référence..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-6">{[...Array(4)].map((_, i) => <div key={i} className="h-14 skeleton mb-2" />)}</div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={<Wallet size={28} />}
          title="Aucun paiement"
          description={search ? "Essayez une autre recherche." : "Les paiements sont enregistrés depuis le détail d'une facture."}
          action={!search && <Link to="/app/invoices" className="btn-primary">Voir mes factures</Link>}
        />
      ) : (
        <div className="glass-card overflow-hidden animate-fade-up">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 dark:text-gray-500 uppercase border-b border-gray-100 dark:border-white/10 bg-white/40 dark:bg-white/5">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Client / Facture</th>
                  <th className="px-5 py-3 font-semibold">Moyen</th>
                  <th className="px-5 py-3 font-semibold">Référence</th>
                  <th className="px-5 py-3 font-semibold text-right">Montant</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/10">
                {payments.map((p) => {
                  const inv = typeof p.invoice === 'object' ? p.invoice : null;
                  const client = typeof inv?.client === 'object' ? inv?.client : null;
                  return (
                    <tr key={p._id} className="hover:bg-white/50 dark:hover:bg-white/10 transition-soft">
                      <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{formatDate(p.date)}</td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-[#0a0a0c] dark:text-white">{client?.nom || '—'}</p>
                        {inv && <Link to={`/app/invoices/${inv._id}`} className="text-xs text-[#d9524d] hover:underline">{inv.numero}</Link>}
                      </td>
                      <td className="px-5 py-4"><span className="badge badge-payee">{METHODE_LABEL[p.methode]}</span></td>
                      <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{p.reference || '—'}</td>
                      <td className="px-5 py-4 text-right font-bold text-green-600">{formatFCFA(p.montant)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          {p.statut === 'complete' && <button className="btn-icon" title="Prévisualiser le reçu" onClick={() => setPreviewPayment(p)}><Receipt size={15} /></button>}
                          <button className="btn-icon" onClick={() => setToDelete(p)}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      <PdfPreviewModal
        open={!!previewPayment}
        onClose={() => setPreviewPayment(null)}
        url={previewPayment ? paymentReceiptUrl(previewPayment._id) : null}
        title="Aperçu du reçu"
        filename={`Recu-${typeof previewPayment?.invoice === 'object' ? previewPayment.invoice.numero : previewPayment?._id}.pdf`}
      />

      <ConfirmDialog
        open={!!toDelete} title="Supprimer le paiement"
        message={`Supprimer ce paiement de ${formatFCFA(toDelete?.montant)} ?`}
        confirmLabel="Supprimer" onConfirm={handleDelete} onClose={() => setToDelete(null)} loading={deleting}
      />
    </div>
  );
}
