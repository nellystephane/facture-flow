import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, ArrowLeft, Save, Plus, Trash2, GripVertical, Lock, Send } from 'lucide-react';
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
import DeviseField from '../components/DeviseField';
import TemplatePicker from '../components/TemplatePicker';
import { formatFCFA as formatBase, todayISO, addDays, deviseInfo, totalHT, totalTTC, apiError } from '../utils/format';
import { getEmecefOptions, type EmecefOptions } from '../api/emecef';

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
  const [emecefOptions, setEmecefOptions] = useState<EmecefOptions | null>(null);
  const [emecefOptionsError, setEmecefOptionsError] = useState('');
  const [loadingFiscalOptions, setLoadingFiscalOptions] = useState(false);

  const [form, setForm] = useState<{
    client: string; objet: string; dateEmission: string; dateEcheance: string;
    items: Item[]; modeFacturation: 'commerciale' | 'normalisee'; remise: number; tva: number; notes: string; fraisSupportesPar: 'utilisateur' | 'client'; statut: InvoiceStatut; template: string; devise: string; tauxChange: number;
  }>({
    client: '',
    objet: '',
    dateEmission: todayISO(),
    dateEcheance: addDays(15),
    items: [{ description: '', quantite: 1, prixUnitaire: 0, taxGroup: null, taxRate: 0, taxSpecific: 0, originalPrice: null, priceModification: '' }] as Item[],
    modeFacturation: 'commerciale',
    remise: 0,
    tva: 0,
    notes: '',
    fraisSupportesPar: 'utilisateur',
    statut: 'brouillon',
    template: 'classique',
    devise: 'XOF',
    tauxChange: 1,
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
          items: d.items?.length ? d.items : [{ description: '', quantite: 1, prixUnitaire: 0, taxGroup: null, taxRate: 0, taxSpecific: 0, originalPrice: null, priceModification: '' }],
          modeFacturation: d.modeFacturation || 'commerciale',
          remise: d.remise || 0,
          tva: d.tva || 0,
          notes: d.notes || '',
          fraisSupportesPar: d.fraisSupportesPar || 'utilisateur',
          statut: (d.statut as 'brouillon') || 'brouillon',
          template: d.template || 'classique',
          devise: d.devise || 'XOF',
          tauxChange: d.tauxChange || 1,
        });
      })
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  useEffect(() => {
    if (form.modeFacturation !== 'normalisee' || emecefOptions || loading) return;
    getEmecefOptions().then((response) => {
      setEmecefOptions(response.data);
      setForm((current) => ({ ...current, items: current.items.map((item) => item.taxGroup && item.taxRate == null
        ? { ...item, taxRate: Number(response.data.taxGroups?.[item.taxGroup.toLowerCase()] ?? 0) }
        : item) }));
    }).catch((error) => {
      setEmecefOptionsError(apiError(error));
      toast(`Impossible de charger les options DGI : ${apiError(error)}`, 'error');
    });
  }, [form.modeFacturation, emecefOptions, loading]);

  const update = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const updateItem = (idx: number, k: keyof Item, v: string | number | null) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [k]: v } : it) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { description: '', quantite: 1, prixUnitaire: 0, taxGroup: f.modeFacturation === 'normalisee' ? 'A' : null, taxRate: f.modeFacturation === 'normalisee' ? Number(emecefOptions?.taxGroups?.a ?? 0) : 0, taxSpecific: 0, originalPrice: null, priceModification: '' }] }));

  const changeInvoiceMode = async (mode: 'commerciale' | 'normalisee') => {
    if (mode === 'commerciale') { setForm((f) => ({ ...f, modeFacturation: mode })); return; }
    if (form.remise > 0) { toast('La remise globale n’est pas encore prise en charge dans le parcours e-MECeF. Retirez-la avant de passer en facture normalisée.', 'error'); return; }
    if (form.devise !== 'XOF') { toast('Les montants e-MECeF de cette intégration sont en FCFA (XOF). Sélectionnez cette devise avant de passer en facture normalisée.', 'error'); return; }
    setLoadingFiscalOptions(true); setEmecefOptionsError('');
    try {
      const response = await getEmecefOptions();
      const options = response.data;
      setEmecefOptions(options);
      const firstGroup = ['a','b','c','d','e','f'].find((key) => options.taxGroups?.[key] !== undefined)?.toUpperCase() as Item['taxGroup'];
      if (!firstGroup) throw new Error('La DGI ne retourne aucun groupe fiscal exploitable.');
      setForm((f) => ({ ...f, modeFacturation: mode, items: f.items.map((item) => {
        const group = item.taxGroup || firstGroup;
        return { ...item, taxGroup: group, taxRate: Number(options.taxGroups[group.toLowerCase()] ?? 0), taxSpecific: Number(item.taxSpecific || 0) };
      }) }));
    } catch (error) {
      setEmecefOptionsError(apiError(error));
      toast(`Impossible de charger les paramètres fiscaux DGI : ${apiError(error)}`, 'error');
    } finally { setLoadingFiscalOptions(false); }
  };

  const selectItemTaxGroup = (idx: number, group: string) => {
    const rate = Number(emecefOptions?.taxGroups?.[group.toLowerCase()]);
    setForm((f) => ({ ...f, items: f.items.map((item, i) => i === idx ? { ...item, taxGroup: group as Item['taxGroup'], taxRate: rate } : item) }));
  };
  const removeItem = (idx: number) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  // Pré-remplir depuis un service existant
  const pickService = (idx: number, serviceId: string) => {
    const s = services.find((x) => x._id === serviceId);
    if (!s) return;
    updateItem(idx, 'description', s.nom);
    updateItem(idx, 'prixUnitaire', s.prix);
    updateItem(idx, 'service', s.suiviStock ? s._id : null);
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
    if (form.modeFacturation === 'normalisee' && form.items.some((i) => !i.taxGroup || !Number.isFinite(Number(i.taxRate)))) { toast('Sélectionnez un groupe fiscal DGI pour chaque ligne.', 'error'); return; }
    if (form.modeFacturation === 'normalisee' && form.remise > 0) { toast('La remise globale n’est pas prise en charge dans le parcours e-MECeF.', 'error'); return; }
    if (form.modeFacturation === 'normalisee' && form.devise !== 'XOF') { toast('Une facture normalisée e-MECeF doit être libellée en FCFA (XOF).', 'error'); return; }
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

  // Tous les montants du document s'affichent dans sa devise ; le catalogue reste en FCFA.
  const formatFCFA = (n: number | null | undefined) => formatBase(n, form.devise);
  const ht = totalHT(form.items, form.remise);
  const fiscalVat = form.modeFacturation === 'normalisee' ? form.items.reduce((sum, item) => sum + Math.round(Math.round(Number(item.prixUnitaire || 0) * (1 + Number(item.taxRate || 0) / 100)) * Number(item.quantite || 0)) - Number(item.prixUnitaire || 0) * Number(item.quantite || 0), 0) : ht * form.tva / 100;
  const ttc = form.modeFacturation === 'normalisee' ? form.items.reduce((sum, item) => sum + Math.round(Math.round(Number(item.prixUnitaire || 0) * (1 + Number(item.taxRate || 0) / 100)) * Number(item.quantite || 0)), 0) + form.items.reduce((sum, item) => sum + Number(item.taxSpecific || 0), 0) : totalTTC(form.items, form.remise, form.tva);

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Modifier la facture' : 'Nouvelle facture'}
        subtitle="Créez une facture professionnelle"
        icon={<FileText size={20} />}
        actions={<button onClick={() => navigate(-1)} className="btn-ghost text-sm"><ArrowLeft size={16} /> Retour</button>}
      />

      <div className="glass-card p-5 mb-5 space-y-3">
        <div><p className="font-semibold text-[#0a0a0c] dark:text-white">Quel type de facture souhaitez-vous créer ?</p><p className="text-xs text-gray-500 mt-1">Ce choix adapte les champs et les calculs dès la création. Il ne déclenche jamais seul une transmission à la DGI.</p></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <button type="button" onClick={() => changeInvoiceMode('commerciale')} className={`text-left rounded-xl border p-4 transition-soft ${form.modeFacturation === 'commerciale' ? 'border-[#d9524d] bg-[#d9524d]/5' : 'border-gray-200 dark:border-white/10'}`}>
            <p className="font-semibold text-sm">Facture commerciale classique</p><p className="text-xs text-gray-500 mt-1">TVA globale, usage commercial habituel, sans préparation e-MECeF intégrée.</p>
          </button>
          <button type="button" disabled={loadingFiscalOptions} onClick={() => changeInvoiceMode('normalisee')} className={`text-left rounded-xl border p-4 transition-soft ${form.modeFacturation === 'normalisee' ? 'border-emerald-500 bg-emerald-500/5' : 'border-gray-200 dark:border-white/10'} ${loadingFiscalOptions ? 'opacity-60' : ''}`}>
            <p className="font-semibold text-sm">Facture normalisée e-MECeF</p><p className="text-xs text-gray-500 mt-1">Groupes fiscaux par article, taux DGI et préparation fiscale dès la saisie.</p>
          </button>
        </div>
        {form.modeFacturation === 'normalisee' && <p className="text-xs text-emerald-700 dark:text-emerald-300">Options fiscales chargées depuis la DGI. L'émission fiscale restera une action séparée après enregistrement.</p>}
        {emecefOptionsError && <p className="text-xs text-red-600">{emecefOptionsError}</p>}
      </div>
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
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
              {form.modeFacturation === 'normalisee' ? <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm"><strong>Devise fiscale : FCFA (XOF)</strong><p className="text-xs text-gray-500 mt-1">L’API e-MECeF de cette intégration attend les montants en FCFA. La devise est verrouillée pour éviter une conversion implicite.</p></div> : <DeviseField devise={form.devise} tauxChange={form.tauxChange} onChange={(d) => setForm((f) => ({ ...f, ...d }))} />}
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
                  {form.modeFacturation === 'normalisee' ? <div className="grid sm:grid-cols-2 gap-3 mt-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 p-3">
                    <div><label className="field-label">Groupe fiscal DGI *</label><select className="field" value={item.taxGroup || ''} onChange={(e) => selectItemTaxGroup(idx, e.target.value)}><option value="">Choisir un groupe</option>{['a','b','c','d','e','f'].filter((key) => emecefOptions?.taxGroups?.[key] !== undefined).map((key) => <option key={key} value={key.toUpperCase()}>{key.toUpperCase()} — {Number(emecefOptions!.taxGroups[key])}%</option>)}</select><p className="text-[11px] text-gray-500 mt-1">Taux récupéré auprès de la DGI.</p></div>
                    <div><label className="field-label">Taxe spécifique (FCFA, facultative)</label><input type="number" min={0} step={1} className="field" value={item.taxSpecific || 0} onChange={(e) => updateItem(idx, 'taxSpecific', Number(e.target.value))} /><p className="text-[11px] text-gray-500 mt-1">À saisir uniquement si cette taxe s'applique réellement à l'article. Ce n'est pas la TVA.</p></div>
                    <div className="sm:col-span-2 text-xs text-gray-600 dark:text-gray-300">TVA calculée pour cette ligne : <strong>{Number(item.taxRate || 0)} %</strong> · TVA estimée : <strong>{formatFCFA(item.quantite * item.prixUnitaire * Number(item.taxRate || 0) / 100)}</strong></div>
                  </div> : <p className="text-xs text-gray-500 mt-2">Facture commerciale : les paramètres fiscaux DGI ne sont pas affichés.</p>}
                  {services.length > 0 && (
                    <div className="mt-2">
                      {permissions?.peutUtiliserFacturationExpress ? (
                        <Select value="" onChange={(v) => pickService(idx, v)} options={[{value:'',label:'Pré-remplir depuis un service...'}, ...services.map(s => ({value:s._id,label:`${s.nom} — ${formatBase(s.prix, 'XOF')}`}))]} className="text-xs py-1" />
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

          {/* Modèle de PDF */}
          <div className="glass-card p-6">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-1">Modèle de PDF</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">L'apparence de la facture une fois téléchargée ou envoyée par email.</p>
            <TemplatePicker value={form.template} onChange={(id) => update('template', id)} allowed={permissions?.modelesFactureDisponibles} lockedLabel="Plan Pro" />
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
                <span className="text-gray-500 dark:text-gray-400">Remise ({deviseInfo(form.devise).label})</span>
                <input type="number" min={0} className="field w-28 text-right py-1" value={form.remise} disabled={form.modeFacturation === 'normalisee'}
                  onChange={(e) => update('remise', Number(e.target.value))} />
              </div>
              {form.modeFacturation === 'commerciale' && <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-gray-400">TVA globale (%)</span>
                <input type="number" min={0} className="field w-28 text-right py-1" value={form.tva}
                  onChange={(e) => update('tva', Number(e.target.value))} />
              </div>}
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100 dark:border-white/10">
                <span className="text-gray-500 dark:text-gray-400">Total HT</span>
                <span className="font-semibold">{formatFCFA(ht)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">TVA {form.modeFacturation === 'normalisee' ? 'par groupe' : ''}</span>
                <span className="font-semibold">{formatFCFA(fiscalVat)}</span>
              </div>
              {form.modeFacturation === 'normalisee' && <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-gray-400">Taxes spécifiques</span><span className="font-semibold">{formatFCFA(form.items.reduce((sum, item) => sum + Number(item.taxSpecific || 0), 0))}</span></div>}
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
                <Send size={18} /> Enregistrer & envoyer par email
              </button>
              <button type="button" onClick={(e) => handleSubmit(e as unknown as React.FormEvent, false)}
                className="btn-ghost w-full justify-center" disabled={saving}>
                <Save size={16} /> {isEdit ? 'Enregistrer sans email' : "Enregistrer — email ultérieur"}
              </button>
            </div>
          </div>
        </div>
      </form>
      <PdfPreviewModal open={!!previewUrl} onClose={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} url={previewUrl} title={isEdit ? 'Aperçu de la facture modifiée' : 'Aperçu de la facture'} filename="Apercu-facture.pdf" />
    </div>
  );
}
