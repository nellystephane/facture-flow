import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Download, Pencil, Trash2,
  FileText, Send, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { getQuote, patchQuoteStatus, deleteQuote, quotePdfUrl } from '../api/quotes';
import { createInvoiceFromQuote } from '../api/invoices';
import type { Quote, QuoteStatut } from '../types';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import { formatFCFA, formatDate, badgeClass, QUOTE_STATUT_LABEL, apiError, totalTTC } from '../utils/format';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getQuote(id)
      .then((res) => setQuote(res.data))
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const openPdf = () => {
    const token = localStorage.getItem('token');
    fetch(quotePdfUrl(id!), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
  };

  const changeStatus = async (statut: QuoteStatut) => {
    try {
      const res = await patchQuoteStatus(id!, statut);
      setQuote(res.data);
      toast('Statut mis à jour');
    } catch (err) { toast(apiError(err), 'error'); }
  };

  const convertToInvoice = async () => {
    setConverting(true);
    try {
      const res = await createInvoiceFromQuote(id!);
      toast('Facture créée depuis le devis');
      navigate(`/app/invoices/${res.data._id}`);
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setConverting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteQuote(id!);
      toast('Devis supprimé');
      navigate('/app/quotes');
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setDeleting(false); }
  };

  if (loading) return <div className="h-96 skeleton" />;
  if (!quote) return <div className="text-center text-gray-500 py-20">Devis introuvable.</div>;

  const client = typeof quote.client === 'object' ? quote.client : null;
  const ttc = quote.totalTTC || totalTTC(quote.items, quote.remise, quote.tva);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 animate-fade-up">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app/quotes')} className="btn-icon"><ArrowLeft size={18} /></button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#0a0a0c]">{quote.numero}</h1>
              <span className={badgeClass(quote.statut)}>{QUOTE_STATUT_LABEL[quote.statut]}</span>
            </div>
            <p className="text-sm text-gray-500">Émis le {formatDate(quote.dateEmission)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openPdf} className="btn-ghost text-sm"><Download size={16} /> PDF</button>
          <Link to={`/app/quotes/${id}/edit`} className="btn-dark text-sm"><Pencil size={16} /> Modifier</Link>
          <button onClick={() => setDeleteOpen(true)} className="btn-icon" title="Supprimer"><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 animate-fade-up">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Adressé à</p>
                <p className="font-bold text-[#0a0a0c]">{client?.nom}</p>
                {client?.entreprise && <p className="text-sm text-gray-600">{client.entreprise}</p>}
                {client?.email && <p className="text-sm text-gray-500">{client.email}</p>}
                {client?.telephone && <p className="text-sm text-gray-500">{client.telephone}</p>}
                {client?.adresse && <p className="text-sm text-gray-500">{client.adresse}</p>}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Détails</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Valable jusqu'au</span><span className="font-medium">{formatDate(quote.dateExpiration)}</span></div>
                  {quote.objet && <div className="flex justify-between"><span className="text-gray-500">Objet</span><span className="font-medium text-right">{quote.objet}</span></div>}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 animate-fade-up">
            <h3 className="font-bold text-[#0a0a0c] mb-4">Articles</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="pb-3 font-semibold">Description</th>
                    <th className="pb-3 font-semibold text-center">Qté</th>
                    <th className="pb-3 font-semibold text-right">Prix unit.</th>
                    <th className="pb-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {quote.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-3 text-[#0a0a0c]">{it.description}</td>
                      <td className="py-3 text-center text-gray-600">{it.quantite}</td>
                      <td className="py-3 text-right text-gray-600">{formatFCFA(it.prixUnitaire)}</td>
                      <td className="py-3 text-right font-semibold">{formatFCFA(it.quantite * it.prixUnitaire)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {quote.notes && (
              <div className="mt-4 p-3 rounded-xl bg-gray-50 text-sm text-gray-600">
                <p className="font-semibold text-gray-700 mb-1">Notes</p>{quote.notes}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 animate-fade-up sticky top-6">
            <h3 className="font-bold text-[#0a0a0c] mb-4">Récapitulatif</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Sous-total</span><span className="font-medium">{formatFCFA(quote.items.reduce((s, i) => s + i.quantite * i.prixUnitaire, 0))}</span></div>
              {quote.remise ? <div className="flex justify-between"><span className="text-gray-500">Remise</span><span className="font-medium text-[#d9524d]">- {formatFCFA(quote.remise)}</span></div> : null}
              <div className="flex justify-between"><span className="text-gray-500">TVA ({quote.tva}%)</span><span className="font-medium">{formatFCFA(ttc / (1 + quote.tva / 100) * quote.tva / 100)}</span></div>
              <div className="rounded-xl p-3 mt-3 text-white" style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}>
                <p className="text-xs text-gray-300 uppercase">Total TTC</p>
                <p className="text-xl font-extrabold">{formatFCFA(ttc)}</p>
              </div>
            </div>

            {/* Convertir en facture */}
            <button onClick={convertToInvoice} className="btn-primary w-full justify-center mt-5" disabled={converting}>
              {converting && <span className="spinner" style={{ width: 16, height: 16 }} />}
              <FileText size={16} /> Transformer en facture
            </button>

            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Statut</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => changeStatus('envoye')} className="btn-ghost text-xs py-2 justify-center"><Send size={13} /> Envoyé</button>
                <button onClick={() => changeStatus('accepte')} className="btn-ghost text-xs py-2 justify-center"><CheckCircle2 size={13} /> Accepté</button>
                <button onClick={() => changeStatus('refuse')} className="btn-ghost text-xs py-2 justify-center"><XCircle size={13} /> Refusé</button>
                <button onClick={() => changeStatus('expire')} className="btn-ghost text-xs py-2 justify-center"><Clock size={13} /> Expiré</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen} title="Supprimer le devis"
        message={`Supprimer définitivement le devis ${quote.numero} ?`}
        confirmLabel="Supprimer" onConfirm={handleDelete} onClose={() => setDeleteOpen(false)} loading={deleting}
      />
    </div>
  );
}
