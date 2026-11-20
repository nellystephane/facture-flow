import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Download, Pencil, Wallet, Trash2,
  XCircle, Mail, Link2, Receipt, Loader2, Lock, MessageCircle, ShieldCheck, CheckCircle2, Save
} from 'lucide-react';
import { authenticatedFetch } from '../api/authenticatedFetch';
import { getEmecefOptions, type EmecefOptions, type EmecefOption } from '../api/emecef';
import { getInvoice, updateInvoice, patchInvoiceStatus, deleteInvoice, invoicePdfUrl, sendInvoiceEmail } from '../api/invoices';
import { createPayment, getPayments, deletePayment, paymentReceiptUrl } from '../api/payments';
import type { Invoice, Item, Payment, MethodePaiement } from '../types';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import DatePicker from '../components/ui/DatePicker';
import PdfPreviewModal from '../components/PdfPreviewModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import InfoHint from '../components/ui/InfoHint';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { formatFCFA as formatBase, deviseInfo, formatDate, badgeClass, INVOICE_STATUT_LABEL, METHODE_LABEL, apiError, totalHT, totalTTC, todayISO, publicAppUrl } from '../utils/format';
import { ouvrirPartageWhatsApp } from '../utils/whatsapp';
import { prepareEmecefInvoice, confirmEmecefInvoice, cancelEmecefInvoice, refreshEmecefInvoiceStatus, resetEmecefInvoice } from '../api/emecef';

function dgiOptionCode(option: EmecefOption): string {
  if (typeof option === 'string') return option.trim().toUpperCase();
  return String(option.type || option.code || option.name || option.value || '').trim().toUpperCase();
}
function dgiOptionDescription(option: EmecefOption): string {
  return typeof option === 'string' ? '' : String(option.description || '');
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [fiscalItems, setFiscalItems] = useState<Item[]>([]);
  const [fiscalItemsDirty, setFiscalItemsDirty] = useState(false);
  const [fiscalItemsSaving, setFiscalItemsSaving] = useState(false);
  // Montants dans la devise de la facture (FCFA par défaut).
  const formatFCFA = (n: number | null | undefined) => formatBase(n, invoice?.devise);
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
        setFiscalItems((invRes.data.items || []).map((item) => ({ ...item })));
        setFiscalItemsDirty(false);
        setPayments(payRes.data.items);
      })
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  useEffect(() => {
    let active = true;
    setEmecefOptionsLoading(true);
    setEmecefOptionsError('');
    getEmecefOptions()
      .then((res) => {
        if (!active) return;
        setEmecefOptions(res.data);
        const availableTypes = (res.data.invoiceTypes || []).map(dgiOptionCode).filter((value) => ['FV', 'FA', 'EV', 'EA'].includes(value));
        const availablePayments = (res.data.paymentTypes || []).map(dgiOptionCode).filter((value) => ['ESPECES', 'CHEQUES', 'MOBILEMONEY', 'CARTEBANCAIRE', 'VIREMENT', 'CREDIT', 'AUTRE'].includes(value));
        setEmecefForm((current) => ({
          ...current,
          invoiceType: availableTypes.includes(current.invoiceType) ? current.invoiceType : ((availableTypes[0] || 'FV') as 'FV' | 'FA' | 'EV' | 'EA'),
          paymentType: availablePayments.includes(current.paymentType) ? current.paymentType : (availablePayments[0] || 'ESPECES'),
          taxGroup: ['a','b','c','d','e','f'].some((key) => key.toUpperCase() === current.taxGroup && res.data.taxGroups?.[key] !== undefined)
            ? current.taxGroup
            : (['a','b','c','d','e','f'].find((key) => res.data.taxGroups?.[key] !== undefined)?.toUpperCase() || 'B'),
        }));
      })
      .catch((err) => {
        if (active) {
          setEmecefOptions(null);
          setEmecefOptionsError(apiError(err));
        }
      })
      .finally(() => { if (active) setEmecefOptionsLoading(false); });
    return () => { active = false; };
  }, [id]);

  const previewPdf = () => { if (id) setPreview({ url: invoicePdfUrl(id), title: `Aperçu de ${invoice?.numero || 'la facture'}`, filename: `Facture-${invoice?.numero || id}.pdf` }); };

  const openPdf = () => {
        authenticatedFetch(invoicePdfUrl(id!))
      .then((r) => r.blob())
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
  };

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [emecefForm, setEmecefForm] = useState({ taxGroup: 'B', paymentType: 'ESPECES', priceBasis: 'HT' as const, invoiceType: 'FV' as 'FV' | 'FA' | 'EV' | 'EA', aib: '' as '' | 'A' | 'B', reference: '' });
  const [emecefBusy, setEmecefBusy] = useState(false);
  const [emecefOptions, setEmecefOptions] = useState<EmecefOptions | null>(null);
  const [emecefOptionsLoading, setEmecefOptionsLoading] = useState(false);
  const [emecefOptionsError, setEmecefOptionsError] = useState('');


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

  const updateFiscalItem = (index: number, key: keyof Item, value: string | number | null) => {
    setFiscalItems((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
    setFiscalItemsDirty(true);
  };

  const handleSaveFiscalItems = async () => {
    if (!id || !invoice) return;
    if (invoice.statut !== 'brouillon') {
      toast('Les paramètres fiscaux par ligne ne peuvent être modifiés que sur une facture encore en brouillon.', 'error');
      return;
    }
    setFiscalItemsSaving(true);
    try {
      const res = await updateInvoice(id, { items: fiscalItems });
      setInvoice(res.data);
      setFiscalItems((res.data.items || []).map((item) => ({ ...item })));
      setFiscalItemsDirty(false);
      toast('Paramètres fiscaux enregistrés. Vérifiez à nouveau le total commercial avant tout envoi.');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setFiscalItemsSaving(false);
    }
  };

  const handlePrepareEmecef = async () => {
    if (!id) return;
    setEmecefBusy(true);
    try {
      const firstConfiguredGroup = invoice?.items.find((item) => item.taxGroup)?.taxGroup;
      const res = await prepareEmecefInvoice(id, { ...emecefForm, taxGroup: firstConfiguredGroup || emecefForm.taxGroup });
      toast(res.data.message || 'Demande envoyée à la DGI.');
      load();
    } catch (err) { toast(apiError(err), 'error'); load(); }
    finally { setEmecefBusy(false); }
  };

  const handleConfirmEmecef = async () => {
    if (!id) return;
    setEmecefBusy(true);
    try {
      await confirmEmecefInvoice(id);
      toast('Facture confirmée par la DGI de test.');
      load();
    } catch (err) { toast(apiError(err), 'error'); load(); }
    finally { setEmecefBusy(false); }
  };

  const handleRefreshEmecefStatus = async () => {
    if (!id) return;
    setEmecefBusy(true);
    try {
      const res = await refreshEmecefInvoiceStatus(id);
      toast(res.data.message || 'État DGI actualisé.');
      load();
    } catch (err) { toast(apiError(err), 'error'); load(); }
    finally { setEmecefBusy(false); }
  };

  const handleResetEmecef = async () => {
    if (!id) return;
    if (!window.confirm('Avez-vous vérifié auprès de la DGI que cette demande n’a pas été finalisée ? La réinitialiser permet de refaire une demande, au risque d’un doublon si elle existe déjà.')) return;
    setEmecefBusy(true);
    try {
      await resetEmecefInvoice(id);
      toast('Fiscalisation réinitialisée. Vous pouvez refaire une demande.');
      load();
    } catch (err) { toast(apiError(err), 'error'); load(); }
    finally { setEmecefBusy(false); }
  };

  const handleCancelEmecef = async () => {
    if (!id) return;
    setEmecefBusy(true);
    try {
      await cancelEmecefInvoice(id);
      toast('Demande e-MECeF annulée dans l’environnement de test.');
      load();
    } catch (err) { toast(apiError(err), 'error'); load(); }
    finally { setEmecefBusy(false); }
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

  const fiscalisationLocksInvoice = ['submitting', 'pending_confirmation', 'confirming', 'cancelling', 'unknown', 'confirmed'].includes(invoice.fiscalisation?.status || '');
  const client = typeof invoice.client === 'object' ? invoice.client : null;
  const ttc = totalTTC(invoice);
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
          {invoice.statut === 'brouillon' && !fiscalisationLocksInvoice ? (
            <>
              <Link to={`/app/invoices/${id}/edit`} className="btn-dark text-sm"><Pencil size={16} /> Modifier</Link>
              <button onClick={() => setDeleteOpen(true)} className="btn-icon" title="Supprimer"><Trash2 size={16} /></button>
            </>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1" title={fiscalisationLocksInvoice ? 'Une demande e-MECeF est en cours, confirmée ou incertaine : modification et suppression bloquées.' : 'Une facture envoyée ne peut plus être modifiée ni supprimée, pour garantir une numérotation fiable.'}>
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
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">{invoice.modeFacturation === 'normalisee' ? 'TVA par groupe fiscal' : `TVA (${invoice.tva}%)`}</span><span className="font-medium">{formatFCFA(invoice.modeFacturation === 'normalisee' ? invoice.items.reduce((sum, item) => sum + Math.round(Math.round(Number(item.prixUnitaire || 0) * (1 + Number(item.taxRate || 0) / 100)) * Number(item.quantite || 0)) - Number(item.prixUnitaire || 0) * Number(item.quantite || 0), 0) : totalHT(invoice.items, invoice.remise) * invoice.tva / 100)}</span></div>
              {invoice.items.some((item) => Number(item.taxSpecific || 0) > 0) && <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Taxes spécifiques</span><span className="font-medium">{formatFCFA(invoice.items.reduce((sum, item) => sum + Number(item.taxSpecific || 0), 0))}</span></div>}
              <div className="rounded-xl p-3 mt-3 text-white" style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}>
                <p className="text-xs text-gray-300 dark:text-gray-600 uppercase">Total TTC</p>
                <p className="text-xl font-extrabold">{formatFCFA(ttc)}</p>
              </div>
              <div className="flex justify-between pt-2"><span className="text-green-600 font-medium">Encaissé</span><span className="font-bold text-green-600">{formatFCFA(totalPaye)}</span></div>
              {reste > 0 && <div className="flex justify-between"><span className="text-[#d9524d] font-medium">Reste à payer</span><span className="font-bold text-[#d9524d]">{formatFCFA(reste)}</span></div>}
            </div>

            {/* Paramètres fiscaux distincts des données commerciales */}
            <div className="mt-5 pt-5 border-t border-gray-100 dark:border-white/10">
              <h3 className="font-bold text-[#0a0a0c] dark:text-white flex items-center gap-2 mb-2"><ShieldCheck size={17} /> Préparation fiscale</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Ces informations servent à préparer la déclaration DGI ; elles ne font pas partie de la saisie commerciale habituelle. Enregistrez-les et contrôlez le total avant de lancer un test.</p>
              {fiscalItems.map((item, index) => (
                <div key={index} className="rounded-xl border border-gray-100 dark:border-white/10 p-3 mb-3 space-y-3">
                  <p className="text-sm font-semibold">Ligne {index + 1} — {item.description}</p>
                  <div>
                    <label className="field-label">Groupe fiscal DGI de la ligne</label>
                    <select className="field" value={item.taxGroup || ''} disabled={invoice.statut !== 'brouillon' || !!invoice.fiscalisation?.status && !['non_emise', 'error'].includes(invoice.fiscalisation.status)} onChange={(e) => { const group = e.target.value || null; const rate = group ? Number(emecefOptions?.taxGroups?.[group.toLowerCase()] ?? 0) : 0; setFiscalItems((current) => current.map((line, i) => i === index ? { ...line, taxGroup: group as Item['taxGroup'], taxRate: rate } : line)); setFiscalItemsDirty(true); }}>
                      <option value="">Utiliser le groupe fiscal général ci-dessous</option>
                      {['A', 'B', 'C', 'D', 'E', 'F'].map((group) => <option key={group} value={group}>{group} — Groupe fiscal DGI</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Taxe spécifique (FCFA, montant total de la ligne)</label>
                    <input type="number" min={0} step={1} className="field" value={item.taxSpecific || 0} disabled={invoice.statut !== 'brouillon' || !!invoice.fiscalisation?.status && !['non_emise', 'error'].includes(invoice.fiscalisation.status)} onChange={(e) => updateFiscalItem(index, 'taxSpecific', Number(e.target.value))} />
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Dans le modèle actuel d’Oryxa, cette taxe est ajoutée au total TTC commercial. Toute modification change donc le montant affiché au client.</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div><label className="field-label">Prix d’origine (facultatif)</label><input type="number" min={0} step={1} className="field" value={item.originalPrice ?? ''} disabled={invoice.statut !== 'brouillon' || !!invoice.fiscalisation?.status && !['non_emise', 'error'].includes(invoice.fiscalisation.status)} onChange={(e) => updateFiscalItem(index, 'originalPrice', e.target.value === '' ? null : Number(e.target.value))} placeholder="Prix avant modification" /></div>
                    <div><label className="field-label">Motif de modification</label><input className="field" maxLength={100} value={item.priceModification || ''} disabled={invoice.statut !== 'brouillon' || !!invoice.fiscalisation?.status && !['non_emise', 'error'].includes(invoice.fiscalisation.status)} onChange={(e) => updateFiscalItem(index, 'priceModification', e.target.value)} placeholder="Motif si prix modifié" /></div>
                  </div>
                  {item.originalPrice != null && !item.priceModification?.trim() && <p className="text-xs text-red-600">Le motif est requis si un prix d’origine est renseigné.</p>}
                </div>
              ))}
              {invoice.statut === 'brouillon' && (!invoice.fiscalisation?.status || ['non_emise', 'error'].includes(invoice.fiscalisation.status)) && (
                <button type="button" onClick={handleSaveFiscalItems} disabled={!fiscalItemsDirty || fiscalItemsSaving} className="btn-ghost w-full justify-center">
                  {fiscalItemsSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer les paramètres fiscaux
                </button>
              )}
              {fiscalItemsDirty && <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Modifications non enregistrées : la transmission DGI reste désactivée.</p>}
            </div>

            {/* Fiscalisation e-MECeF séparée du PDF commercial Oryxa */}
            <div className="mt-5 pt-5 border-t border-gray-100 dark:border-white/10">
              <h3 className="font-bold text-[#0a0a0c] dark:text-white flex items-center gap-2 mb-2"><ShieldCheck size={17} className="text-[#d9524d]" /> e-MECeF (test DGI)</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Cette action envoie les données à la plateforme de test de la DGI. Le PDF commercial actuel n’est pas un PDF fiscal certifié.</p>
              <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 mb-3 text-sm">
                <div className="flex justify-between gap-2"><span className="text-gray-500">État</span><strong>{invoice.fiscalisation?.status || 'non_emise'}</strong></div>
                {invoice.fiscalisation?.uid && <div className="mt-1 break-all"><span className="text-gray-500">UID :</span> {invoice.fiscalisation.uid}</div>}
                {invoice.fiscalisation?.expectedTotal != null && <div className="mt-1"><span className="text-gray-500">Total attendu :</span> {formatFCFA(invoice.fiscalisation.expectedTotal)}</div>}
                {invoice.fiscalisation?.dgiTotal != null && <div className="mt-1"><span className="text-gray-500">Total calculé DGI :</span> {formatFCFA(invoice.fiscalisation.dgiTotal)}</div>}
                {invoice.fiscalisation?.errorDesc && <p className="text-red-600 mt-2">{invoice.fiscalisation.errorCode ? `Erreur ${invoice.fiscalisation.errorCode} : ` : ''}{invoice.fiscalisation.errorDesc}</p>}
                {invoice.fiscalisation?.status === 'confirmed' && <div className="mt-2 space-y-1"><p className="text-green-700 dark:text-green-400 flex items-center gap-1"><CheckCircle2 size={14} /> Confirmation DGI réussie</p><p><span className="text-gray-500">Code MECeF/DGI :</span> <strong>{invoice.fiscalisation.codeMECeFDGI || '—'}</strong></p><p><span className="text-gray-500">NIM :</span> {invoice.fiscalisation.nim || '—'}</p><p><span className="text-gray-500">Date DGI :</span> {invoice.fiscalisation.dateTime || '—'}</p><p><span className="text-gray-500">Compteur :</span> {invoice.fiscalisation.counters || '—'}</p><p className="break-all"><span className="text-gray-500">Contenu QR fiscal DGI :</span> {invoice.fiscalisation.qrCode || '—'}</p><p className="text-xs text-green-700 dark:text-green-400">Le PDF téléchargé inclut le QR fiscal DGI distinct du QR de paiement, après confirmation.</p></div>}
                {invoice.fiscalisation?.status === 'confirmed' && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Cette facture est fiscalisée : son annulation directe est bloquée. Pour la corriger, émettez un avoir FA/EA distinct avec le code MECeF/DGI de l’original, puis vérifiez ce scénario sur la plateforme DGI.</p>}
              </div>
              {(!invoice.fiscalisation?.status || invoice.fiscalisation.status === 'non_emise' || invoice.fiscalisation.status === 'error') && (
                <div className="space-y-3">
                  {emecefOptionsLoading && <p className="text-xs text-gray-500">Chargement des paramètres fiscaux depuis la DGI…</p>}
                  {emecefOptionsError && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-700 dark:text-red-300">Impossible de charger les options DGI : {emecefOptionsError}<button type="button" className="underline ml-1" onClick={() => { setEmecefOptionsError(''); setEmecefOptionsLoading(true); getEmecefOptions().then((r) => setEmecefOptions(r.data)).catch((e) => setEmecefOptionsError(apiError(e))).finally(() => setEmecefOptionsLoading(false)); }}>Réessayer</button></div>}
                  {emecefOptions && <p className="text-xs text-green-700 dark:text-green-400">Options DGI chargées. NIM : {emecefOptions.status?.nim || 'non communiqué'}.</p>}
                  <div><label className="field-label">Type de facture DGI (options chargées depuis la DGI)</label><select className="field" value={emecefForm.invoiceType} disabled={!emecefOptions || emecefOptionsLoading} onChange={(e) => setEmecefForm({ ...emecefForm, invoiceType: e.target.value as 'FV' | 'FA' | 'EV' | 'EA' })}>{(emecefOptions?.invoiceTypes || []).filter((type) => ['FV', 'FA', 'EV', 'EA'].includes(dgiOptionCode(type))).map((type) => { const value = dgiOptionCode(type); const labels: Record<string, string> = { FV: 'Facture de vente', FA: 'Facture d’avoir', EV: 'Vente à l’exportation', EA: 'Avoir à l’exportation' }; return <option key={value} value={value}>{value} — {dgiOptionDescription(type) || labels[value] || value}</option>; })}</select></div>
                  {['FA', 'EA'].includes(emecefForm.invoiceType) && <div><label className="field-label">Code MECeF/DGI de la facture originale (référence)</label><input className="field" value={emecefForm.reference} maxLength={29} placeholder="Code MECeF/DGI original" onChange={(e) => setEmecefForm({ ...emecefForm, reference: e.target.value.trim() })} /><p className="text-xs text-gray-500 mt-1">Obligatoire pour les avoirs ; utilisez le code de la facture originale déjà confirmée par la DGI.</p></div>}
                  <div><label className="field-label">AIB (taux retournés par la DGI)</label><select className="field" value={emecefForm.aib} disabled={!emecefOptions || emecefOptionsLoading} onChange={(e) => setEmecefForm({ ...emecefForm, aib: e.target.value as '' | 'A' | 'B' })}><option value="">Aucun AIB</option>{Number(emecefOptions?.taxGroups?.aibA) > 0 && <option value="A">AIB A — {Number(emecefOptions!.taxGroups.aibA)} %</option>}{Number(emecefOptions?.taxGroups?.aibB) > 0 && <option value="B">AIB B — {Number(emecefOptions!.taxGroups.aibB)} %</option>}</select></div>
                  {invoice.items.some((item) => !item.taxGroup) && <div><label className="field-label">Groupe fiscal par défaut (pour les lignes non renseignées)</label><select className="field" value={emecefForm.taxGroup} disabled={!emecefOptions || emecefOptionsLoading} onChange={(e) => setEmecefForm({ ...emecefForm, taxGroup: e.target.value })}>{['a','b','c','d','e','f'].filter((key) => emecefOptions?.taxGroups?.[key] !== undefined).map((key) => <option key={key} value={key.toUpperCase()}>{key.toUpperCase()} — {Number(emecefOptions!.taxGroups[key])}%</option>)}</select></div>}
                  {invoice.items.every((item) => !!item.taxGroup) && <p className="text-xs text-emerald-700 dark:text-emerald-300">Les groupes fiscaux sont définis article par article. Oryxa transmettra chaque ligne avec son groupe respectif.</p>}
                  <p className="text-xs text-gray-500">Base de prix : HT (comme dans le calcul des factures Oryxa). La TVA est ajoutée avant l’envoi à la DGI.</p>
                  <div><label className="field-label">Mode de paiement déclaré (options DGI)</label><select className="field" value={emecefForm.paymentType} disabled={!emecefOptions || emecefOptionsLoading} onChange={(e) => setEmecefForm({ ...emecefForm, paymentType: e.target.value })}>{(emecefOptions?.paymentTypes || []).filter((type) => ['ESPECES', 'CHEQUES', 'MOBILEMONEY', 'CARTEBANCAIRE', 'VIREMENT', 'CREDIT', 'AUTRE'].includes(dgiOptionCode(type))).map((type) => { const value = dgiOptionCode(type); const labels: Record<string, string> = { ESPECES: 'Espèces', CHEQUES: 'Chèques', MOBILEMONEY: 'Mobile Money', CARTEBANCAIRE: 'Carte bancaire', VIREMENT: 'Virement', CREDIT: 'Crédit', AUTRE: 'Autre' }; return <option key={value} value={value}>{dgiOptionDescription(type) || labels[value] || value}</option>; })}</select></div>
                  <p className="text-xs text-amber-700 dark:text-amber-400">La DGI reste l’autorité de calcul fiscal. Les remises globales sont bloquées tant que leur représentation exacte n’est pas prise en charge. Pour un avoir, vérifiez la référence originale avant l’envoi.</p>
                  <button onClick={handlePrepareEmecef} disabled={emecefBusy || fiscalItemsDirty || fiscalItemsSaving || invoice.statut === 'annulee' || !emecefOptions || emecefOptionsLoading || !emecefOptions.invoiceTypes.some((type) => ['FV', 'FA', 'EV', 'EA'].includes(dgiOptionCode(type))) || !emecefOptions.paymentTypes.some((type) => ['ESPECES', 'CHEQUES', 'MOBILEMONEY', 'CARTEBANCAIRE', 'VIREMENT', 'CREDIT', 'AUTRE'].includes(dgiOptionCode(type)))} className="btn-primary w-full justify-center">{emecefBusy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Envoyer à la DGI (test)</button>
                </div>
              )}
              {invoice.fiscalisation?.status === 'pending_confirmation' && <div className="space-y-2"><p className="text-xs text-amber-700 dark:text-amber-400">La demande existe chez la DGI. Confirmez rapidement ; ne créez pas une deuxième demande si la réponse est incertaine.</p><button onClick={handleConfirmEmecef} disabled={emecefBusy} className="btn-primary w-full justify-center">{emecefBusy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Confirmer auprès de la DGI</button><button onClick={handleCancelEmecef} disabled={emecefBusy} className="btn-ghost w-full justify-center">Annuler la demande de test</button></div>}
              {['unknown', 'pending_confirmation', 'confirming', 'cancelling'].includes(invoice.fiscalisation?.status || '') && <div className="space-y-2"><p className="text-sm text-amber-700 dark:text-amber-400">{invoice.fiscalisation?.status === 'pending_confirmation' ? 'Vérifiez que la demande est toujours en attente avant de confirmer.' : 'Résultat incertain ou opération en cours. Ne renvoyez pas cette facture ; vérifiez son état auprès de la DGI.'}</p>{invoice.fiscalisation?.uid ? <button onClick={handleRefreshEmecefStatus} disabled={emecefBusy} className="btn-ghost w-full justify-center">{emecefBusy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Vérifier l’état auprès de la DGI</button> : <p className="text-xs text-red-600">Aucun UID DGI n’a été enregistré. Vérifiez les demandes récentes dans Swagger ou auprès de la DGI avant toute nouvelle tentative.</p>}{['unknown', 'confirming', 'cancelling'].includes(invoice.fiscalisation?.status || '') && <button onClick={handleResetEmecef} disabled={emecefBusy} className="btn-ghost w-full justify-center">Réinitialiser après vérification auprès de la DGI</button>}</div>}
            </div>

            {/* Annulation — seule transition de statut manuelle : tout le
                reste (envoyée, vue, payée, en retard) découle d'une action
                réelle (envoi effectif, ouverture du lien client, paiement,
                détection automatique de retard). */}
            {invoice.statut !== 'payee' && invoice.statut !== 'annulee' && !['submitting', 'pending_confirmation', 'confirming', 'cancelling', 'unknown', 'confirmed'].includes(invoice.fiscalisation?.status || '') && (
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
            <label className="field-label">Montant ({deviseInfo(invoice?.devise).label}) *</label>
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
