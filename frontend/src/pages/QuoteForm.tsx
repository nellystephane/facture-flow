import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileSpreadsheet, ArrowLeft, Save, Plus, Trash2, GripVertical, Lock } from 'lucide-react';
import { getQuote, createQuote, updateQuote, previewQuotePdf } from '../api/quotes';
import { getAllClients } from '../api/clients';
import { getServices } from '../api/services';
import type { Client, Service, Item } from '../types';
import PageHeader from '../components/ui/PageHeader';
import Select from '../components/ui/Select';
import DatePicker from '../components/ui/DatePicker';
import PdfPreviewModal from '../components/PdfPreviewModal';
import { useToast } from '../contexts/ToastContext';
import { formatFCFA, todayISO, addDays, totalHT, totalTTC, apiError } from '../utils/format';
import { usePermissions } from '../contexts/PermissionsContext';

const TEMPLATES = [
  { id: 'classique', label: 'Classique', desc: 'Référence Oryxa, sobre et universelle' },
  { id: 'moderne', label: 'Moderne', desc: 'En-tête structuré et accents contemporains' },
  { id: 'minimal', label: 'Minimal', desc: 'Typographie légère et espaces généreux' },
  { id: 'atelier', label: 'Atelier', desc: 'Éditorial, chaleureux et artisanal' },
  { id: 'horizon', label: 'Horizon', desc: 'Carte latérale et hiérarchie élégante' },
  { id: 'prestige', label: 'Prestige', desc: 'En-tête sombre et présentation haut de gamme' },
  { id: 'corporate', label: 'Corporate', desc: 'Institutionnel, structuré et très lisible' },
  { id: 'signature', label: 'Signature', desc: 'Identité éditoriale raffinée et distinctive' },
  { id: 'noir', label: 'Noir', desc: 'Contraste premium et présence visuelle forte' },
];

export default function QuoteForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permissions } = usePermissions();

  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const [form, setForm] = useState({
    client: '',
    objet: '',
    dateEmission: todayISO(),
    dateExpiration: addDays(30),
    items: [{ description: '', quantite: 1, prixUnitaire: 0 }] as Item[],
    remise: 0,
    tva: 0,
    notes: '',
    template: 'classique',
  });

  useEffect(() => {
    getAllClients().then((res) => {
      setClients(res.data.items);
      if (res.data.items.length) setForm((f) => ({ ...f, client: res.data.items[0]._id }));
    }).catch(() => {});
    getServices().then((res) => setServices(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    getQuote(id!)
      .then((res) => {
        const d = res.data;
        setForm({
          client: typeof d.client === 'object' ? d.client._id : d.client,
          objet: d.objet || '',
          dateEmission: d.dateEmission ? new Date(d.dateEmission).toISOString().split('T')[0] : todayISO(),
          dateExpiration: d.dateExpiration ? new Date(d.dateExpiration).toISOString().split('T')[0] : addDays(30),
          items: d.items?.length ? d.items : [{ description: '', quantite: 1, prixUnitaire: 0 }],
          remise: d.remise || 0,
          tva: d.tva || 0,
          notes: d.notes || '',
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
      const res = await previewQuotePdf(form);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(res.data));
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setPreviewing(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client) { toast('Sélectionnez un client', 'error'); return; }
    if (form.items.some((i) => !i.description.trim())) { toast('Toutes les lignes doivent avoir une description', 'error'); return; }
    setSaving(true);
    try {
      if (isEdit) { await updateQuote(id!, form); toast('Devis mis à jour'); }
      else { await createQuote(form); toast('Devis créé'); }
      navigate('/app/quotes');
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="h-96 skeleton" />;

  const ht = totalHT(form.items, form.remise);
  const ttc = totalTTC(form.items, form.remise, form.tva);

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Modifier le devis' : 'Nouveau devis'}
        subtitle="Proposez une offre à votre client"
        icon={<FileSpreadsheet size={20} />}
        actions={<button onClick={() => navigate(-1)} className="btn-ghost text-sm"><ArrowLeft size={16} /> Retour</button>}
      />

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-6 animate-fade-up">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-4">Informations</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Client *</label>
                <Select value={form.client} onChange={(v) => update('client', v)} options={[{value:'',label:'— Sélectionner —'}, ...clients.map(c => ({value:c._id,label:`${c.nom}${c.entreprise ? ` (${c.entreprise})` : ''}`}))]} />
              </div>
              <div>
                <label className="field-label">Objet</label>
                <input className="field" value={form.objet} onChange={(e) => update('objet', e.target.value)} placeholder="Ex: Travaux de rénovation" />
              </div>
              <div>
                <label className="field-label">Date d'émission</label>
                <DatePicker value={form.dateEmission} onChange={(v) => update('dateEmission', v)} />
              </div>
              <div>
                <label className="field-label">Valable jusqu'au</label>
                <DatePicker value={form.dateExpiration} onChange={(v) => update('dateExpiration', v)} />
              </div>
            </div>
          </div>

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
                      <button type="button" onClick={() => removeItem(idx)} className="ml-auto text-gray-400 dark:text-gray-500 hover:text-[#d9524d]"><Trash2 size={15} /></button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5">
                      <input className="field" placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <input type="number" min={0} step="any" className="field" placeholder="Qté" value={item.quantite} onChange={(e) => updateItem(idx, 'quantite', Number(e.target.value))} />
                    </div>
                    <div className="sm:col-span-3">
                      <input type="number" min={0} step="any" className="field" placeholder="Prix unit." value={item.prixUnitaire} onChange={(e) => updateItem(idx, 'prixUnitaire', Number(e.target.value))} />
                    </div>
                    <div className="sm:col-span-2 flex items-center font-semibold text-[#0a0a0c] dark:text-white text-sm">{formatFCFA(item.quantite * item.prixUnitaire)}</div>
                  </div>
                  {services.length > 0 && (
                    <div className="mt-2">
                      <Select value="" onChange={(v) => pickService(idx, v)} options={[{value:'',label:'Pré-remplir depuis un service...'}, ...services.map(s => ({value:s._id,label:`${s.nom} — ${formatFCFA(s.prix)}`}))]} className="text-xs py-1" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Modèle de PDF */}
          <div className="glass-card p-6">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-1">Modèle de PDF</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Le même système de templates que les factures, avec prévisualisation avant envoi.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TEMPLATES.map((t) => {
                const disponible = permissions?.modelesFactureDisponibles.includes(t.id) ?? (t.id === 'classique');
                return (
                  <button key={t.id} type="button" disabled={!disponible}
                    onClick={() => disponible && update('template', t.id)}
                    className={`relative p-3 rounded-xl border text-left transition-soft ${form.template === t.id ? 'border-[#d9524d] bg-[#d9524d]/5' : 'border-gray-100 dark:border-white/10'} ${!disponible ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-300 dark:hover:border-white/20'}`}>
                    {!disponible && <Lock size={13} className="absolute top-2 right-2 text-gray-400 dark:text-gray-500" />}
                    <p className="text-sm font-semibold text-[#0a0a0c] dark:text-white">{t.label}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{disponible ? t.desc : 'Plan Pro ou Business'}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-6">
            <label className="field-label">Notes / Conditions</label>
            <textarea className="field" rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Conditions, délais d'exécution..." />
          </div>
        </div>

        <div>
          <div className="glass-card p-6 sticky top-6">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-4">Totaux</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-gray-400">Sous-total</span><span className="font-semibold">{formatFCFA(form.items.reduce((s, i) => s + i.quantite * i.prixUnitaire, 0))}</span></div>
              <div className="flex justify-between items-center text-sm"><span className="text-gray-500 dark:text-gray-400">Remise (FCFA)</span><input type="number" min={0} className="field w-28 text-right py-1" value={form.remise} onChange={(e) => update('remise', Number(e.target.value))} /></div>
              <div className="flex justify-between items-center text-sm"><span className="text-gray-500 dark:text-gray-400">TVA (%)</span><input type="number" min={0} className="field w-28 text-right py-1" value={form.tva} onChange={(e) => update('tva', Number(e.target.value))} /></div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100 dark:border-white/10"><span className="text-gray-500 dark:text-gray-400">Total HT</span><span className="font-semibold">{formatFCFA(ht)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-gray-400">TVA</span><span className="font-semibold">{formatFCFA(ht * form.tva / 100)}</span></div>
              <div className="rounded-xl p-3 mt-3 text-white" style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}>
                <p className="text-xs text-gray-300 dark:text-gray-600 uppercase">Total TTC</p>
                <p className="text-xl font-extrabold">{formatFCFA(ttc)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button type="button" onClick={handlePreview} className="btn-ghost w-full justify-center" disabled={saving || previewing}>
                {previewing ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <span>◫</span>} Prévisualiser
              </button>
              <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
              {saving && <span className="spinner" style={{ width: 16, height: 16 }} />}
                <Save size={18} /> {isEdit ? 'Mettre à jour' : 'Créer le devis'}
              </button>
            </div>
          </div>
        </div>
      </form>
      <PdfPreviewModal open={!!previewUrl} onClose={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} url={previewUrl} title={isEdit ? 'Aperçu du devis modifié' : 'Aperçu du devis'} filename="Apercu-devis.pdf" />
    </div>
  );
}
