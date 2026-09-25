import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, ArrowLeft, Save, Plus, Trash2, GripVertical, Lock, Eye, Send } from 'lucide-react';
import { getInvoice, createInvoice, updateInvoice, sendInvoiceEmail, previewInvoicePdf } from '../api/invoices';
import { getAllClients } from '../api/clients';
import { getServices } from '../api/services';
import type { Client, Service, Item, InvoiceStatut } from '../types';
import PageHeader from '../components/ui/PageHeader';
import Select from '../components/ui/Select';
import DatePicker from '../components/ui/DatePicker';
import PdfPreviewModal from '../components/PdfPreviewModal';
import { useToast } from '../contexts/ToastContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { formatFCFA, todayISO, addDays, totalHT, totalTTC, apiError } from '../utils/format';

const TEMPLATES = [
  { id: 'classique', label: 'Classique', tier: 'Gratuit', desc: 'Sobre, lisible et disponible pour tous.', tone: 'bg-white', accent: '#c9504b', layout: 'classic' },
  { id: 'moderne', label: 'Moderne', tier: 'Pro', desc: 'Hiérarchie nette et accent bleu contemporain.', tone: 'bg-blue-50', accent: '#2563eb', layout: 'modern' },
  { id: 'minimal', label: 'Minimal', tier: 'Pro', desc: 'Très épuré, beaucoup d’espace et peu de bruit.', tone: 'bg-gray-50', accent: '#111111', layout: 'minimal' },
  { id: 'atelier', label: 'Atelier', tier: 'Pro', desc: 'Chaleureux et professionnel, idéal pour services et artisans.', tone: 'bg-emerald-50', accent: '#0f766e', layout: 'atelier' },
  { id: 'horizon', label: 'Horizon', tier: 'Pro', desc: 'Créatif et élégant avec une signature violette.', tone: 'bg-violet-50', accent: '#7c3aed', layout: 'horizon' },
  { id: 'prestige', label: 'Prestige', tier: 'Business', desc: 'Sombre, premium et pensé pour les propositions haut de gamme.', tone: 'bg-zinc-900', accent: '#a16207', layout: 'prestige' },
  { id: 'corporate', label: 'Corporate', tier: 'Business', desc: 'Institutionnel, structuré et adapté aux clients B2B.', tone: 'bg-slate-900', accent: '#0f172a', layout: 'corporate' },
  { id: 'signature', label: 'Signature', tier: 'Business', desc: 'Élégant et distinctif pour une identité plus affirmée.', tone: 'bg-pink-50', accent: '#be185d', layout: 'signature' },
  { id: 'noir', label: 'Noir', tier: 'Business', desc: 'Contraste fort et rendu premium pour l’envoi numérique.', tone: 'bg-gray-900', accent: '#111827', layout: 'noir' },
];

export default function InvoiceForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { permissions } = usePermissions();

  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const [form, setForm] = useState<{
    client: string; objet: string; dateEmission: string; dateEcheance: string;
    items: Item[]; remise: number; tva: number; notes: string; fraisSupportesPar: 'utilisateur' | 'client'; statut: InvoiceStatut; template: string;
  }>({
    client: '',
    objet: '',
    dateEmission: todayISO(),
    dateEcheance: addDays(15),
    items: [{ description: '', quantite: 1, prixUnitaire: 0 }] as Item[],
    remise: 0,
    tva: 0,
    notes: '',
    fraisSupportesPar: 'utilisateur',
    statut: 'brouillon',
    template: 'classique',
  });

  useEffect(() => {
    getAllClients().then((res) => {
      setClients(res.data.items);
      const preselected = searchParams.get('client');
      if (preselected) setForm((f) => ({ ...f, client: preselected }));
      else if (res.data.items.length) setForm((f) => ({ ...f, client: res.data.items[0]._id }));
    }).catch(() => {});
    getServices().then((res) => setServices(res.data)).catch(() => {});
  }, [searchParams]);

  useEffect(() => {
    if (!isEdit) return;
    getInvoice(id!)
      .then((res) => {
        const d = res.data;
        setForm({
          client: typeof d.client === 'object' ? d.client._id : d.client,
          objet: d.objet || '',
          dateEmission: d.dateEmission ? new Date(d.dateEmission).toISOString().split('T')[0] : todayISO(),
          dateEcheance: d.dateEcheance ? new Date(d.dateEcheance).toISOString().split('T')[0] : '',
          items: d.items?.length ? d.items : [{ description: '', quantite: 1, prixUnitaire: 0 }],
          remise: d.remise || 0,
          tva: d.tva || 0,
          notes: d.notes || '',
          fraisSupportesPar: d.fraisSupportesPar || 'utilisateur',
          statut: (d.statut as 'brouillon') || 'brouillon',
          template: d.template || 'classique',
        });
      })
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const update = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const updateItem = (idx: number, k: keyof Item, v: string | number) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [k]: v } : it) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { description: '', quantite: 1, prixUnitaire: 0 }] }));
  const removeItem = (idx: number) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  // Pré-remplir depuis un service existant
  const pickService = (idx: number, serviceId: string) => {
    const s = services.find((x) => x._id === serviceId);
    if (!s) return;
    updateItem(idx, 'description', s.nom);
    updateItem(idx, 'prixUnitaire', s.prix);
  };

  const handlePreview = async () => {
    if (!form.client) { toast('Sélectionnez un client avant la prévisualisation.', 'error'); return; }
    if (form.items.some((i) => !i.description.trim())) { toast('Toutes les lignes doivent avoir une description.', 'error'); return; }
    setPreviewing(true);
    try {
      const res = await previewInvoicePdf(form);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(res.data));
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setPreviewing(false); }
  };

  const handleSubmit = async (e: React.FormEvent, envoyerAussi = false) => {
    e.preventDefault();
    if (!form.client) { toast('Sélectionnez un client', 'error'); return; }
    if (form.items.some((i) => !i.description.trim())) { toast('Toutes les lignes doivent avoir une description', 'error'); return; }
    setSaving(true);
    try {
      // Le statut n'est jamais envoyé ici : il reflète toujours une action
      // réelle (voir sendInvoiceEmail ci-dessous), jamais un choix libre du
      // formulaire — une facture "envoyée" doit avoir été réellement envoyée.
      const { statut, ...payload } = form;
      void statut;
      let invoiceId = id;
      if (isEdit) {
        await updateInvoice(id!, payload);
      } else {
        const res = await createInvoice(payload);
        invoiceId = res.data._id;
      }

      if (envoyerAussi && invoiceId) {
        try {
          await sendInvoiceEmail(invoiceId);
          toast('Facture enregistrée et envoyée par email');
        } catch (err) {
          toast(`Facture enregistrée, mais l'envoi a échoué : ${apiError(err)}`, 'error');
        }
      } else {
        toast(isEdit ? 'Facture mise à jour' : 'Facture enregistrée — en attente d\'envoi');
      }
      navigate('/app/invoices');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-96 skeleton" />;

  const ht = totalHT(form.items, form.remise);
  const ttc = totalTTC(form.items, form.remise, form.tva);

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Modifier la facture' : 'Nouvelle facture'}
        subtitle="Créez une facture professionnelle"
        icon={<FileText size={20} />}
        actions={<button onClick={() => navigate(-1)} className="btn-ghost text-sm"><ArrowLeft size={16} /> Retour</button>}
      />

      <form onSubmit={(e) => handleSubmit(e)} className="grid lg:grid-cols-3 gap-6 animate-fade-up">
        <div className="lg:col-span-2 space-y-6">
          {/* Infos générales */}
          <div className="glass-card p-6">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-4">Informations</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Client *</label>
                <Select value={form.client} onChange={(v) => update('client', v)} options={[{value:'',label:'— Sélectionner —'}, ...clients.map(c => ({value:c._id,label:`${c.nom}${c.entreprise ? ` (${c.entreprise})` : ''}`}))]} />
              </div>
              <div>
                <label className="field-label">Objet</label>
                <input className="field" value={form.objet} onChange={(e) => update('objet', e.target.value)} placeholder="Ex: Prestation de design" />
              </div>
              <div>
                <label className="field-label">Date d'émission</label>
                <DatePicker value={form.dateEmission} onChange={(v) => update('dateEmission', v)} />
              </div>
              <div>
                <label className="field-label">Date d'échéance</label>
                <DatePicker value={form.dateEcheance} onChange={(v) => update('dateEcheance', v)} />
              </div>
            </div>
          </div>

          {/* Frais de paiement en ligne */}
          <div className="glass-card p-6">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-1">Frais de paiement en ligne</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Choisissez qui supporte les frais techniques. Oryxa calculera automatiquement le montant affiché au client.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => update('fraisSupportesPar', 'utilisateur')} className={`text-left rounded-2xl p-4 border transition-soft ${form.fraisSupportesPar === 'utilisateur' ? 'border-[#d9524d] bg-[#d9524d]/5' : 'border-gray-200 dark:border-white/10'}`}>
                <p className="font-semibold text-sm text-[#0a0a0c] dark:text-white">Je supporte les frais</p>
                <p className="text-xs text-gray-500 mt-1">Le client paie uniquement le montant de la facture.</p>
              </button>
              <button type="button" onClick={() => update('fraisSupportesPar', 'client')} className={`text-left rounded-2xl p-4 border transition-soft ${form.fraisSupportesPar === 'client' ? 'border-[#d9524d] bg-[#d9524d]/5' : 'border-gray-200 dark:border-white/10'}`}>
                <p className="font-semibold text-sm text-[#0a0a0c] dark:text-white">Mon client supporte les frais</p>
                <p className="text-xs text-gray-500 mt-1">Le total à payer inclut automatiquement les frais de transfert.</p>
              </button>
            </div>
          </div>

          {/* Articles */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#0a0a0c] dark:text-white">Articles</h3>
              <button type="button" onClick={addItem} className="btn-ghost text-xs py-1.5"><Plus size={14} /> Ajouter une ligne</button>
            </div>

            <div className="space-y-3">
              {form.items.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-gray-100 dark:border-white/10 bg-white/40 dark:bg-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <GripVertical size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500">Ligne {idx + 1}</span>
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="ml-auto text-gray-400 dark:text-gray-500 hover:text-[#d9524d]">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5">
                      <input className="field" placeholder="Description" value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <input type="number" min={0} step="any" className="field" placeholder="Qté" value={item.quantite}
                        onChange={(e) => updateItem(idx, 'quantite', Number(e.target.value))} />
                    </div>
                    <div className="sm:col-span-3">
                      <input type="number" min={0} step="any" className="field" placeholder="Prix unit." value={item.prixUnitaire}
                        onChange={(e) => updateItem(idx, 'prixUnitaire', Number(e.target.value))} />
                    </div>
                    <div className="sm:col-span-2 flex items-center font-semibold text-[#0a0a0c] dark:text-white text-sm">
                      {formatFCFA(item.quantite * item.prixUnitaire)}
                    </div>
                  </div>
                  {services.length > 0 && (
                    <div className="mt-2">
                      {permissions?.peutUtiliserFacturationExpress ? (
                        <Select value="" onChange={(v) => pickService(idx, v)} options={[{value:'',label:'Pré-remplir depuis un service...'}, ...services.map(s => ({value:s._id,label:`${s.nom} — ${formatFCFA(s.prix)}`}))]} className="text-xs py-1" />
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                          <Lock size={11} /> Pré-remplissage depuis vos tarifs — plan Pro
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="glass-card p-6">
            <label className="field-label">Notes / Conditions</label>
            <textarea className="field" rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)}
              placeholder="Conditions de paiement, coordonnées bancaires..." />
          </div>

          {/* Modèles de PDF */}
          <div className="glass-card p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-[#0a0a0c] dark:text-white">Modèle de PDF</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Le modèle choisi sera utilisé pour le PDF envoyé ou téléchargé. Prévisualisez-le avant l'envoi.</p>
              </div>
              <Eye size={18} className="text-gray-400 shrink-0" />
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {TEMPLATES.map((t) => {
                const disponible = permissions?.modelesFactureDisponibles.includes(t.id) ?? (t.id === 'classique');
                const selected = form.template === t.id;
                return (
                  <div key={t.id} className={`relative rounded-2xl border overflow-hidden transition-soft ${selected ? 'border-[#d9524d] ring-1 ring-[#d9524d]/20' : 'border-gray-100 dark:border-white/10'} ${!disponible ? 'opacity-55' : ''}`}>
                    <button type="button" disabled={!disponible} onClick={() => disponible && update('template', t.id)} className="w-full text-left">
                      <div className={`h-24 p-3 ${t.tone}`}>
                        <div className="h-full rounded-lg bg-white/90 dark:bg-black/20 shadow-sm p-2.5" style={{ borderTop: `4px solid ${t.accent}` }}>
                          <div className="flex justify-between items-start gap-2">
                            <div className="space-y-1 flex-1"><div className="h-1.5 w-16 rounded bg-gray-300/80" /><div className="h-1 w-24 rounded bg-gray-200/80" /></div>
                            <div className="h-5 w-10 rounded" style={{ background: t.accent, opacity: .9 }} />
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-1"><span className="h-1 rounded bg-gray-200"/><span className="h-1 rounded bg-gray-200"/><span className="h-1 rounded bg-gray-200"/></div>
                        </div>
                      </div>
                      <div className="p-3 bg-white dark:bg-[#121214]">
                        <div className="flex items-center gap-2"><p className="text-sm font-semibold text-[#0a0a0c] dark:text-white">{t.label}</p><span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500">{t.tier}</span></div>
                        <p className="text-[11px] leading-4 text-gray-400 dark:text-gray-500 mt-1">{t.desc}</p>
                      </div>
                    </button>
                    {!disponible && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-black/90 px-3 py-1.5 text-xs font-semibold shadow"><Lock size={12}/> Réservé au {t.tier}</span></div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar totaux */}
        <div className="space-y-6">
          <div className="glass-card p-6 sticky top-6">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-4">Totaux</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Sous-total</span>
                <span className="font-semibold">{formatFCFA(form.items.reduce((s, i) => s + i.quantite * i.prixUnitaire, 0))}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-gray-400">Remise (FCFA)</span>
                <input type="number" min={0} className="field w-28 text-right py-1" value={form.remise}
                  onChange={(e) => update('remise', Number(e.target.value))} />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-gray-400">TVA (%)</span>
                <input type="number" min={0} className="field w-28 text-right py-1" value={form.tva}
                  onChange={(e) => update('tva', Number(e.target.value))} />
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100 dark:border-white/10">
                <span className="text-gray-500 dark:text-gray-400">Total HT</span>
                <span className="font-semibold">{formatFCFA(ht)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">TVA</span>
                <span className="font-semibold">{formatFCFA(ht * form.tva / 100)}</span>
              </div>
              <div className="rounded-xl p-3 mt-3 text-white"
                style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}>
                <p className="text-xs text-gray-300 dark:text-gray-600 uppercase">Total TTC</p>
                <p className="text-xl font-extrabold">{formatFCFA(ttc)}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button type="button" onClick={handlePreview} className="btn-ghost w-full justify-center" disabled={saving || previewing}>
                {previewing ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <span>◫</span>} Prévisualiser le PDF
              </button>
              <button type="button" onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
                className="btn-primary w-full justify-center" disabled={saving}>
                {saving && <span className="spinner" style={{ width: 16, height: 16 }} />}
                <Send size={18} /> Enregistrer & Envoyer
              </button>
              <button type="button" onClick={(e) => handleSubmit(e as unknown as React.FormEvent, false)}
                className="btn-ghost w-full justify-center" disabled={saving}>
                <Save size={16} /> {isEdit ? 'Enregistrer sans envoyer' : "Enregistrer, envoyer plus tard"}
              </button>
            </div>
          </div>
        </div>
      </form>
      <PdfPreviewModal open={!!previewUrl} onClose={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} url={previewUrl} title={isEdit ? 'Aperçu de la facture modifiée' : 'Aperçu de la facture'} filename="Apercu-facture.pdf" />
    </div>
  );
}
