import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Plus, Search, Eye, Download, Filter } from 'lucide-react';
import { getQuotes, quotePdfUrl } from '../api/quotes';
import type { Quote } from '../types';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import Pagination from '../components/ui/Pagination';
import { formatFCFA, formatDate, badgeClass, QUOTE_STATUT_LABEL } from '../utils/format';

const STATUTS = [
  { value: '', label: 'Tous' },
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'envoye', label: 'Envoyé' },
  { value: 'accepte', label: 'Accepté' },
  { value: 'refuse', label: 'Refusé' },
];

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = () => {
    setLoading(true);
    getQuotes({ statut: statut || undefined, q: search || undefined, page })
      .then((res) => {
        setQuotes(res.data.items);
        setTotalPages(res.data.totalPages);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [statut, page]);

  useEffect(() => {
    const t = setTimeout(() => { if (page !== 1) setPage(1); else load(); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openPdf = (id: string) => {
    const token = localStorage.getItem('token');
    fetch(quotePdfUrl(id), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
  };

  return (
    <div>
      <PageHeader
        title="Devis"
        subtitle={`${total} devis au total`}
        icon={<FileSpreadsheet size={20} />}
        actions={<Link to="/app/quotes/new" className="btn-primary text-sm"><Plus size={18} /> Nouveau devis</Link>}
      />

      <div className="glass-card p-4 mb-6 animate-fade-up">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="field pl-10" placeholder="Rechercher par N° ou client..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative">
            <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select className="field pl-10 pr-10" value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}>
              {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-6">{[...Array(4)].map((_, i) => <div key={i} className="h-12 skeleton mb-2" />)}</div>
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet size={28} />}
          title="Aucun devis"
          description={search || statut ? "Essayez d'autres critères." : 'Créez des devis professionnels que vous pourrez transformer en factures.'}
          action={!search && !statut && <Link to="/app/quotes/new" className="btn-primary"><Plus size={18} /> Créer un devis</Link>}
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
                  <th className="px-5 py-3 font-semibold">Expiration</th>
                  <th className="px-5 py-3 font-semibold">Montant</th>
                  <th className="px-5 py-3 font-semibold">Statut</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quotes.map((q) => {
                  const client = typeof q.client === 'object' ? q.client : null;
                  return (
                    <tr key={q._id} className="hover:bg-white/50 transition-soft">
                      <td className="px-5 py-4">
                        <Link to={`/app/quotes/${q._id}`} className="font-bold text-[#0a0a0c] hover:text-[#d9524d]">{q.numero}</Link>
                      </td>
                      <td className="px-5 py-4 text-gray-700">{client?.nom || '—'}</td>
                      <td className="px-5 py-4 text-gray-500">{formatDate(q.dateEmission)}</td>
                      <td className="px-5 py-4 text-gray-500">{formatDate(q.dateExpiration)}</td>
                      <td className="px-5 py-4 font-semibold">{formatFCFA(q.totalTTC)}</td>
                      <td className="px-5 py-4"><span className={badgeClass(q.statut)}>{QUOTE_STATUT_LABEL[q.statut]}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">
                          <Link to={`/app/quotes/${q._id}`} className="btn-icon" title="Voir"><Eye size={15} /></Link>
                          <button className="btn-icon" onClick={() => openPdf(q._id)} title="PDF"><Download size={15} /></button>
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
    </div>
  );
}
