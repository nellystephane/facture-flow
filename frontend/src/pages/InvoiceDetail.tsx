import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Download, Pencil, Wallet, Trash2,
  XCircle, Mail, Link2, Receipt, Loader2, Lock, MessageCircle
} from 'lucide-react';
import { getInvoice, patchInvoiceStatus, deleteInvoice, invoicePdfUrl, sendInvoiceEmail } from '../api/invoices';
import { createPayment, getPayments, deletePayment, paymentReceiptUrl } from '../api/payments';
import type { Invoice, Payment, MethodePaiement } from '../types';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import DatePicker from '../components/ui/DatePicker';
import PdfPreviewModal from '../components/PdfPreviewModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import InfoHint from '../components/ui/InfoHint';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { formatFCFA, formatDate, badgeClass, INVOICE_STATUT_LABEL, METHODE_LABEL, apiError, totalTTC, todayISO, publicAppUrl } from '../utils/format';
import { ouvrirPartageWhatsApp } from '../utils/whatsapp';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
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
  const [preview, setPreview] = useState<{ url: string; title: string; filename: string } | null>(null);

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([getInvoice(id), getPayments({ invoice: id, limit: 100 })])
      .then(([invRes, payRes]) => {
        setInvoice(invRes.data);
        setPayments(payRes.data.items);
      })
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const previewPdf = () => { if (id) setPreview({ url: invoicePdfUrl(id), title: `Aperçu de ${invoice?.numero || 'la facture'}`, filename: `Facture-${invoice?.numero || id}.pdf` }); };

  const openPdf = () => {
    const token = localStorage.getItem('token');
    fetch(invoicePdfUrl(id!), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
  };

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await patchInvoiceStatus(id!, 'annulee');
      setInvoice(res.data);
      setCancelOpen(false);
      toast('Facture annulée');
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setCancelling(false); }
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

  const paymentLink = invoice?.publicToken ? publicAppUrl(`payer/${invoice.publicToken}`) : null;

  const handleCopyLink = async () => {
    if (!paymentLink) return;
    await navigator.clipboard.writeText(paymentLink);
    setLinkCopied(true);
    toast('Lien de paiement copié');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const partagerWhatsApp = () => {
    if (!invoice) return;
    const entreprise = user?.entreprise || user?.nom || 'Oryxa';
    const prenom = client?.nom ? client.nom.split(' ')[0] : '';
    const lien = paymentLink || publicAppUrl(`payer/${invoice.publicToken}`);
    const echeance = invoice.dateEcheance ? ` (à régler avant le ${formatDate(invoice.dateEcheance)})` : '';
    const message = [
      `Bonjour ${prenom},`.trim(),
      `Voici votre facture ${invoice.numero} de ${entreprise} : ${formatFCFA(totalTTC(invoice))}${echeance}.`,
      `Vous pouvez la consulter et la payer en ligne ici : ${lien}`,
    ].join('\n');
    ouvrirPartageWhatsApp(message, client?.whatsapp || client?.telephone);
  };

  const openReceipt = (paymentId: string) => {
    setPreview({ url: paymentReceiptUrl(paymentId), title: 'Aperçu du reçu', filename: `Recu-${invoice?.numero || paymentId}.pdf` });
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
  if (!invoice) return <div className="text-center text-gray-500 dark:text-gray-400 py-20">Facture introuvable.</div>;

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
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#0a0a0c] dark:text-white">{invoice.numero}</h1>
              <span className={badgeClass(invoice.statut)}>{INVOICE_STATUT_LABEL[invoice.statut]}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Émise le {formatDate(invoice.dateEmission)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={handleSendEmail} disabled={sendingEmail} className="btn-primary text-sm">
            {sendingEmail ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Envoyer par email
          </button>
          <button onClick={partagerWhatsApp} className="btn-ghost text-sm !text-[#25D366] !border-[#25D366]/30 hover:!bg-[#25D366]/10">
            <MessageCircle size={16} /> WhatsApp
          </button>
          <button onClick={previewPdf} className="btn-ghost text-sm"><span className="text-base leading-none">◫</span> Prévisualiser</button>
          <button onClick={openPdf} className="btn-ghost text-sm"><Download size={16} /> PDF</button>
          {invoice.statut === 'brouillon' ? (
            <>
              <Link to={`/app/invoices/${id}/edit`} className="btn-dark text-sm"><Pencil size={16} /> Modifier</Link>
              <button onClick={() => setDeleteOpen(true)} className="btn-icon" title="Supprimer"><Trash2 size={16} /></button>
            </>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1" title="Une facture envoyée ne peut plus être modifiée ni supprimée, pour garantir une numérotation fiable. Utilisez le statut « Annulée » si besoin.">
              <Lock size={13} /> Verrouillée
            </span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Détail */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client + objet */}
          <div className="glass-card p-6 animate-fade-up">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2">Facturé à</p>
                <p className="font-bold text-[#0a0a0c] dark:text-white">{client?.nom}</p>
                {client?.entreprise && <p className="text-sm text-gray-600 dark:text-gray-400">{client.entreprise}</p>}
                {client?.email && <p className="text-sm text-gray-500 dark:text-gray-400">{client.email}</p>}
                {client?.telephone && <p className="text-sm text-gray-500 dark:text-gray-400">{client.telephone}</p>}
                {client?.adresse && <p className="text-sm text-gray-500 dark:text-gray-400">{client.adresse}</p>}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-2">Détails</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Échéance</span><span className="font-medium">{formatDate(invoice.dateEcheance)}</span></div>
                  {invoice.objet && <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Objet</span><span className="font-medium text-right">{invoice.objet}</span></div>}
                </div>
              </div>
            </div>
          </div>

          {/* Articles */}
          <div className="glass-card p-6 animate-fade-up">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-4">Articles</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 dark:text-gray-500 uppercase border-b border-gray-100 dark:border-white/10">
                    <th className="pb-3 font-semibold">Description</th>
                    <th className="pb-3 font-semibold text-center">Qté</th>
                    <th className="pb-3 font-semibold text-right">Prix unit.</th>
                    <th className="pb-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/10">
                  {invoice.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-3 text-[#0a0a0c] dark:text-white">{it.description}</td>
                      <td className="py-3 text-center text-gray-600 dark:text-gray-400">{it.quantite}</td>
                      <td className="py-3 text-right text-gray-600 dark:text-gray-400">{formatFCFA(it.prixUnitaire)}</td>
                      <td className="py-3 text-right font-semibold">{formatFCFA(it.quantite * it.prixUnitaire)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invoice.notes && (
              <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-white/5 text-sm text-gray-600 dark:text-gray-400">
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Notes</p>
                {invoice.notes}
              </div>
            )}
          </div>

          {/* Lien de paiement client */}
          {paymentLink && invoice.statut !== 'payee' && invoice.statut !== 'annulee' && (
            <div className="glass-card p-6 animate-fade-up">
              <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-2 flex items-center gap-2">
                <Link2 size={18} /> Page de paiement client
                <InfoHint text="Ce lien est unique à cette facture. Votre client peut l'ouvrir sans créer de compte, choisir son moyen de paiement (Mobile Money, carte, virement) et payer directement. Le statut de la facture se met à jour automatiquement dès la confirmation." />
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Ce lien permet au client de payer en ligne (Mobile Money, carte, virement) sans créer de compte. Il est aussi inclus automatiquement dans l'email et le PDF de la facture.</p>
              <div className="flex flex-wrap gap-2">
                <input readOnly className="field flex-1 min-w-[220px] text-xs text-gray-500 dark:text-gray-400" value={paymentLink} onClick={(e) => (e.target as HTMLInputElement).select()} />
                <button onClick={handleCopyLink} className="btn-ghost text-sm shrink-0">{linkCopied ? 'Copié !' : 'Copier'}</button>
              </div>
            </div>
          )}

          {/* Historique paiements */}
          <div className="glass-card p-6 animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#0a0a0c] dark:text-white flex items-center gap-2"><Wallet size={18} /> Paiements</h3>
              <button onClick={() => setPayModal(true)} className="btn-ghost text-xs py-1.5"><Wallet size={14} /> Enregistrer un paiement en espèces</button>
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Aucun paiement enregistré</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => {
                  const statut = p.statut || 'complete';
                  return (
                    <div key={p._id} className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/10 gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-[#0a0a0c] dark:text-white">{formatFCFA(p.montant)}</p>
                          {statut === 'en_attente' && <span className="badge badge-envoyee">En attente</span>}
                          {statut === 'echoue' && <span className="badge badge-en_retard">Échoué</span>}
                          {p.origine === 'en_ligne' && <span className="badge badge-vue">En ligne</span>}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{METHODE_LABEL[p.methode]} • {formatDate(p.date)}{p.reference ? ` • ${p.reference}` : ''}</p>
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
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-4">Récapitulatif</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Sous-total</span><span className="font-medium">{formatFCFA(invoice.items.reduce((s, i) => s + i.quantite * i.prixUnitaire, 0))}</span></div>
              {invoice.remise ? <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Remise</span><span className="font-medium text-[#d9524d]">- {formatFCFA(invoice.remise)}</span></div> : null}
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">TVA ({invoice.tva}%)</span><span className="font-medium">{formatFCFA(ttc / (1 + invoice.tva / 100) * invoice.tva / 100)}</span></div>
              <div className="rounded-xl p-3 mt-3 text-white" style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}>
                <p className="text-xs text-gray-300 dark:text-gray-600 uppercase">Total TTC</p>
                <p className="text-xl font-extrabold">{formatFCFA(ttc)}</p>
              </div>
              <div className="flex justify-between pt-2"><span className="text-green-600 font-medium">Encaissé</span><span className="font-bold text-green-600">{formatFCFA(totalPaye)}</span></div>
              {reste > 0 && <div className="flex justify-between"><span className="text-[#d9524d] font-medium">Reste à payer</span><span className="font-bold text-[#d9524d]">{formatFCFA(reste)}</span></div>}
            </div>

            {/* Annulation — seule transition de statut manuelle : tout le
                reste (envoyée, vue, payée, en retard) découle d'une action
                réelle (envoi effectif, ouverture du lien client, paiement,
                détection automatique de retard). */}
            {invoice.statut !== 'payee' && invoice.statut !== 'annulee' && (
              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-white/10">
                <button onClick={() => setCancelOpen(true)} className="btn-ghost text-xs py-2 justify-center w-full text-[#b23c37]">
                  <XCircle size={13} /> Annuler la facture
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <PdfPreviewModal open={!!preview} onClose={() => setPreview(null)} url={preview?.url || null} title={preview?.title || 'Aperçu'} filename={preview?.filename} />

      <ConfirmDialog
        open={cancelOpen}
        title="Annuler la facture"
        message={`Voulez-vous vraiment annuler la facture ${invoice.numero} ? Cette action est définitive — la facture restera visible mais ne pourra plus être payée.`}
        confirmLabel="Oui, annuler"
        onConfirm={handleCancel}
        onClose={() => setCancelOpen(false)}
        loading={cancelling}
      />

      {/* Modal paiement */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Enregistrer un paiement">
        <form onSubmit={handlePay} className="space-y-4">
          <div>
            <label className="field-label">Montant (FCFA) *</label>
            <input type="number" min={0} step="any" className="field" value={payForm.montant}
              onChange={(e) => setPayForm({ ...payForm, montant: Number(e.target.value) })}
              placeholder={String(Math.round(reste))} required autoFocus />
            {reste > 0 && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Reste à payer : {formatFCFA(reste)}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Moyen</label>
              <Select value={payForm.methode} onChange={(v) => setPayForm({ ...payForm, methode: v as MethodePaiement })} options={Object.entries(METHODE_LABEL).map(([value,label]) => ({value,label}))} />
            </div>
            <div>
              <label className="field-label">Date</label>
              <DatePicker value={payForm.date} onChange={(v) => setPayForm({ ...payForm, date: v })} />
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
