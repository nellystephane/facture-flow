import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Download, Pencil, Wallet, Trash2,
  Send, CheckCircle2, Clock, XCircle, Mail, Link2, Receipt, Loader2
} from 'lucide-react';
import { getInvoice, patchInvoiceStatus, deleteInvoice, invoicePdfUrl, sendInvoiceEmail } from '../api/invoices';
import { createPayment, getPayments, deletePayment, paymentReceiptUrl } from '../api/payments';
import type { Invoice, Payment, InvoiceStatut, MethodePaiement } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import InfoHint from '../components/ui/InfoHint';
import { useToast } from '../contexts/ToastContext';
import { formatFCFA, formatDate, badgeClass, INVOICE_STATUT_LABEL, METHODE_LABEL, apiError, totalTTC, todayISO } from '../utils/format';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payForm, setPayForm] = useState({ montant: 0, methode: 'especes' as MethodePaiement, date: todayISO(), reference: '' });
  const [paySaving, setPaySaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([getInvoice(id), getPayments({ invoice: id })])
      .then(([invRes, payRes]) => {
        setInvoice(invRes.data);
        setPayments(payRes.data);
      })
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const openPdf = () => {
    const token = localStorage.getItem('token');
    fetch(invoicePdfUrl(id!), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
  };

  const changeStatus = async (statut: InvoiceStatut) => {
    try {
      const res = await patchInvoiceStatus(id!, statut);
      setInvoice(res.data);
      toast('Statut mis à jour');
    } catch (err) { toast(apiError(err), 'error'); }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaySaving(true);
    try {
      await createPayment({ invoice: id, ...payForm });
      toast('Paiement enregistré');
      setPayModal(false);
      setPayForm({ montant: 0, methode: 'especes', date: todayISO(), reference: '' });
      load();
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setPaySaving(false); }
  };

  const handleDeletePay = async (pid: string) => {
    try {
      await deletePayment(pid);
      toast('Paiement supprimé');
      load();
    } catch (err) { toast(apiError(err), 'error'); }
  };

  const handleSendEmail = async () => {
    if (!client?.email) {
      toast("Ce client n'a pas d'adresse email enregistrée.", 'error');
      return;
    }
    setSendingEmail(true);
    try {
      const res = await sendInvoiceEmail(id!);
      setInvoice(res.data.invoice);
      toast(`Facture envoyée à ${client.email}`);
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setSendingEmail(false); }
  };

  const paymentLink = invoice?.publicToken ? `${window.location.origin}/payer/${invoice.publicToken}` : null;

  const handleCopyLink = async () => {
    if (!paymentLink) return;
    await navigator.clipboard.writeText(paymentLink);
    setLinkCopied(true);
    toast('Lien de paiement copié');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const openReceipt = (paymentId: string) => {
    const token = localStorage.getItem('token');
    fetch(paymentReceiptUrl(paymentId), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteInvoice(id!);
      toast('Facture supprimée');
      navigate('/app/invoices');
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setDeleting(false); }
  };

  if (loading) return <div className="h-96 skeleton" />;
  if (!invoice) return <div className="text-center text-gray-500 py-20">Facture introuvable.</div>;

  const client = typeof invoice.client === 'object' ? invoice.client : null;
  const ttc = invoice.totalTTC || totalTTC(invoice.items, invoice.remise, invoice.tva);
  const paiementsCompletes = payments.filter((p) => (p.statut || 'complete') === 'complete');
  const totalPaye = paiementsCompletes.reduce((s, p) => s + p.montant, 0);
  const reste = ttc - totalPaye;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 animate-fade-up">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app/invoices')} className="btn-icon"><ArrowLeft size={18} /></button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#0a0a0c]">{invoice.numero}</h1>
              <span className={badgeClass(invoice.statut)}>{INVOICE_STATUT_LABEL[invoice.statut]}</span>
            </div>
            <p className="text-sm text-gray-500">Émise le {formatDate(invoice.dateEmission)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleSendEmail} disabled={sendingEmail} className="btn-primary text-sm">
            {sendingEmail ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Envoyer par email
          </button>
          <button onClick={openPdf} className="btn-ghost text-sm"><Download size={16} /> PDF</button>
          <Link to={`/app/invoices/${id}/edit`} className="btn-dark text-sm"><Pencil size={16} /> Modifier</Link>
          <button onClick={() => setDeleteOpen(true)} className="btn-icon" title="Supprimer"><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Détail */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client + objet */}
          <div className="glass-card p-6 animate-fade-up">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Facturé à</p>
                <p className="font-bold text-[#0a0a0c]">{client?.nom}</p>
                {client?.entreprise && <p className="text-sm text-gray-600">{client.entreprise}</p>}
                {client?.email && <p className="text-sm text-gray-500">{client.email}</p>}
                {client?.telephone && <p className="text-sm text-gray-500">{client.telephone}</p>}
                {client?.adresse && <p className="text-sm text-gray-500">{client.adresse}</p>}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Détails</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Échéance</span><span className="font-medium">{formatDate(invoice.dateEcheance)}</span></div>
                  {invoice.objet && <div className="flex justify-between"><span className="text-gray-500">Objet</span><span className="font-medium text-right">{invoice.objet}</span></div>}
                </div>
              </div>
            </div>
          </div>

          {/* Articles */}
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
                  {invoice.items.map((it, i) => (
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

            {invoice.notes && (
              <div className="mt-4 p-3 rounded-xl bg-gray-50 text-sm text-gray-600">
                <p className="font-semibold text-gray-700 mb-1">Notes</p>
                {invoice.notes}
              </div>
            )}
          </div>

          {/* Lien de paiement client */}
          {paymentLink && invoice.statut !== 'payee' && invoice.statut !== 'annulee' && (
            <div className="glass-card p-6 animate-fade-up">
              <h3 className="font-bold text-[#0a0a0c] mb-2 flex items-center gap-2">
                <Link2 size={18} /> Page de paiement client
                <InfoHint text="Ce lien est unique à cette facture. Votre client peut l'ouvrir sans créer de compte, choisir son moyen de paiement (Mobile Money, carte, virement) et payer directement. Le statut de la facture se met à jour automatiquement dès la confirmation." />
              </h3>
              <p className="text-sm text-gray-500 mb-3">Ce lien permet au client de payer en ligne (Mobile Money, carte, virement) sans créer de compte. Il est aussi inclus automatiquement dans l'email et le PDF de la facture.</p>
              <div className="flex flex-wrap gap-2">
                <input readOnly className="field flex-1 min-w-[220px] text-xs text-gray-500" value={paymentLink} onClick={(e) => (e.target as HTMLInputElement).select()} />
                <button onClick={handleCopyLink} className="btn-ghost text-sm shrink-0">{linkCopied ? 'Copié !' : 'Copier'}</button>
              </div>
            </div>
          )}

          {/* Historique paiements */}
          <div className="glass-card p-6 animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#0a0a0c] flex items-center gap-2"><Wallet size={18} /> Paiements</h3>
              <button onClick={() => setPayModal(true)} className="btn-ghost text-xs py-1.5"><Wallet size={14} /> Enregistrer un paiement en espèces</button>
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucun paiement enregistré</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => {
                  const statut = p.statut || 'complete';
                  return (
                    <div key={p._id} className="flex items-center justify-between p-3 rounded-xl bg-white/50 border border-gray-100 gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-[#0a0a0c]">{formatFCFA(p.montant)}</p>
                          {statut === 'en_attente' && <span className="badge badge-envoyee">En attente</span>}
                          {statut === 'echoue' && <span className="badge badge-en_retard">Échoué</span>}
                          {p.origine === 'en_ligne' && <span className="badge badge-vue">En ligne</span>}
                        </div>
                        <p className="text-xs text-gray-500">{METHODE_LABEL[p.methode]} • {formatDate(p.date)}{p.reference ? ` • ${p.reference}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {statut === 'complete' && (
                          <button onClick={() => openReceipt(p._id)} className="btn-icon" title="Télécharger le reçu"><Receipt size={14} /></button>
                        )}
                        <button onClick={() => handleDeletePay(p._id)} className="btn-icon"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Totaux */}
          <div className="glass-card p-6 animate-fade-up sticky top-6">
            <h3 className="font-bold text-[#0a0a0c] mb-4">Récapitulatif</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Sous-total</span><span className="font-medium">{formatFCFA(invoice.items.reduce((s, i) => s + i.quantite * i.prixUnitaire, 0))}</span></div>
              {invoice.remise ? <div className="flex justify-between"><span className="text-gray-500">Remise</span><span className="font-medium text-[#d9524d]">- {formatFCFA(invoice.remise)}</span></div> : null}
              <div className="flex justify-between"><span className="text-gray-500">TVA ({invoice.tva}%)</span><span className="font-medium">{formatFCFA(ttc / (1 + invoice.tva / 100) * invoice.tva / 100)}</span></div>
              <div className="rounded-xl p-3 mt-3 text-white" style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}>
                <p className="text-xs text-gray-300 uppercase">Total TTC</p>
                <p className="text-xl font-extrabold">{formatFCFA(ttc)}</p>
              </div>
              <div className="flex justify-between pt-2"><span className="text-green-600 font-medium">Encaissé</span><span className="font-bold text-green-600">{formatFCFA(totalPaye)}</span></div>
              {reste > 0 && <div className="flex justify-between"><span className="text-[#d9524d] font-medium">Reste à payer</span><span className="font-bold text-[#d9524d]">{formatFCFA(reste)}</span></div>}
            </div>

            {/* Actions statut */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Changer le statut</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => changeStatus('envoyee')} className="btn-ghost text-xs py-2 justify-center"><Send size={13} /> Envoyée</button>
                <button onClick={() => changeStatus('payee')} className="btn-ghost text-xs py-2 justify-center"><CheckCircle2 size={13} /> Payée</button>
                <button onClick={() => changeStatus('en_retard')} className="btn-ghost text-xs py-2 justify-center"><Clock size={13} /> En retard</button>
                <button onClick={() => changeStatus('annulee')} className="btn-ghost text-xs py-2 justify-center"><XCircle size={13} /> Annulée</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal paiement */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Enregistrer un paiement">
        <form onSubmit={handlePay} className="space-y-4">
          <div>
            <label className="field-label">Montant (FCFA) *</label>
            <input type="number" min={0} step="any" className="field" value={payForm.montant}
              onChange={(e) => setPayForm({ ...payForm, montant: Number(e.target.value) })}
              placeholder={String(Math.round(reste))} required autoFocus />
            {reste > 0 && <p className="text-xs text-gray-400 mt-1">Reste à payer : {formatFCFA(reste)}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Moyen</label>
              <select className="field" value={payForm.methode} onChange={(e) => setPayForm({ ...payForm, methode: e.target.value as MethodePaiement })}>
                {Object.entries(METHODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Date</label>
              <input type="date" className="field" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Référence</label>
            <input className="field" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="N° transaction..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setPayModal(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={paySaving}>
              {paySaving && <span className="spinner" style={{ width: 16, height: 16 }} />} Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteOpen} title="Supprimer la facture"
        message={`Supprimer définitivement la facture ${invoice.numero} ?`}
        confirmLabel="Supprimer" onConfirm={handleDelete} onClose={() => setDeleteOpen(false)} loading={deleting}
      />
    </div>
  );
}
