import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Search, Eye, Download, Filter } from 'lucide-react';
import { getInvoices } from '../api/invoices';
import { invoicePdfUrl } from '../api/invoices';
import type { Invoice, InvoiceStatut } from '../types';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { formatFCFA, formatDate, badgeClass, INVOICE_STATUT_LABEL } from '../utils/format';

const STATUTS: { value: string; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'envoyee', label: 'Envoyée' },
  { value: 'payee', label: 'Payée' },
  { value: 'en_retard', label: 'En retard' },
];

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('');

  useEffect(() => {
    setLoading(true);
    getInvoices(statut ? { statut } : undefined)
      .then((res) => setInvoices(res.data))
      .finally(() => setLoading(false));
  }, [statut]);

  const filtered = invoices.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const client = typeof inv.client === 'object' ? inv.client : null;
    return inv.numero.toLowerCase().includes(q) || (client?.nom || '').toLowerCase().includes(q);
  });

  const openPdf = (id: string) => {
    const token = localStorage.getItem('token');
    // On ouvre le PDF via un fetch authentifié qu'on convertit en blob
    fetch(invoicePdfUrl(id), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      });
  };

  return (
    <div>
      <PageHeader
        title="Factures"
        subtitle={`${invoices.length} facture(s)`}
        icon={<FileText size={20} />}
        actions={<Link to="/app/invoices/new" className="btn-primary text-sm"><Plus size={18} /> Nouvelle facture</Link>}
      />

      {/* Filtres */}
      <div className="glass-card p-4 mb-6 animate-fade-up">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="field pl-10" placeholder="Rechercher par N° ou client..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative">
            <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select className="field pl-10 pr-10" value={statut} onChange={(e) => setStatut(e.target.value)}>
              {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-6"><div className="h-12 skeleton mb-3" />{[...Array(4)].map((_, i) => <div key={i} className="h-12 skeleton mb-2" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title="Aucune facture"
          description="Créez votre première facture en quelques secondes."
          action={<Link to="/app/invoices/new" className="btn-primary"><Plus size={18} /> Créer une facture</Link>}
        />
      ) : (
        <div className="glass-card overflow-hidden animate-fade-up">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100 bg-white/40">
                  <th className="px-5 py-3 font-semibold">N°</th>
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Échéance</th>
                  <th className="px-5 py-3 font-semibold">Montant</th>
                  <th className="px-5 py-3 font-semibold">Statut</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((inv) => {
                  const client = typeof inv.client === 'object' ? inv.client : null;
                  return (
                    <tr key={inv._id} className="hover:bg-white/50 transition-soft">
                      <td className="px-5 py-4">
                        <Link to={`/app/invoices/${inv._id}`} className="font-bold text-[#0a0a0c] hover:text-[#d9524d]">{inv.numero}</Link>
                      </td>
                      <td className="px-5 py-4 text-gray-700">{client?.nom || '—'}</td>
                      <td className="px-5 py-4 text-gray-500">{formatDate(inv.dateEmission)}</td>
                      <td className="px-5 py-4 text-gray-500">{formatDate(inv.dateEcheance)}</td>
                      <td className="px-5 py-4 font-semibold text-[#0a0a0c]">{formatFCFA(inv.totalTTC)}</td>
                      <td className="px-5 py-4"><span className={badgeClass(inv.statut)}>{INVOICE_STATUT_LABEL[inv.statut as InvoiceStatut]}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">
                          <Link to={`/app/invoices/${inv._id}`} className="btn-icon" title="Voir"><Eye size={15} /></Link>
                          <button className="btn-icon" onClick={() => openPdf(inv._id)} title="Télécharger PDF"><Download size={15} /></button>
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
    </div>
  );
}
