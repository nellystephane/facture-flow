import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, ArrowLeft, Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { getInvoice, createInvoice, updateInvoice } from '../api/invoices';
import { getClients } from '../api/clients';
import { getServices } from '../api/services';
import type { Client, Service, Item, InvoiceStatut } from '../types';
import PageHeader from '../components/ui/PageHeader';
import { useToast } from '../contexts/ToastContext';
import { formatFCFA, todayISO, addDays, totalHT, totalTTC, apiError } from '../utils/format';

export default function InvoiceForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<{
    client: string; objet: string; dateEmission: string; dateEcheance: string;
    items: Item[]; remise: number; tva: number; notes: string; statut: InvoiceStatut;
  }>({
    client: '',
    objet: '',
    dateEmission: todayISO(),
    dateEcheance: addDays(15),
    items: [{ description: '', quantite: 1, prixUnitaire: 0 }] as Item[],
    remise: 0,
    tva: 0,
    notes: '',
    statut: 'brouillon',
  });

  useEffect(() => {
    getClients().then((res) => {
      setClients(res.data);
      const preselected = searchParams.get('client');
      if (preselected) setForm((f) => ({ ...f, client: preselected }));
      else if (res.data.length) setForm((f) => ({ ...f, client: res.data[0]._id }));
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
          statut: (d.statut as 'brouillon') || 'brouillon',
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

  const handleSubmit = async (e: React.FormEvent, statutOverride?: InvoiceStatut) => {
    e.preventDefault();
    if (!form.client) { toast('Sélectionnez un client', 'error'); return; }
    if (form.items.some((i) => !i.description.trim())) { toast('Toutes les lignes doivent avoir une description', 'error'); return; }
    setSaving(true);
    try {
      const payload = { ...form, statut: statutOverride || form.statut };
      if (isEdit) {
        await updateInvoice(id!, payload);
        toast('Facture mise à jour');
      } else {
        await createInvoice(payload);
        toast('Facture créée');
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
            <h3 className="font-bold text-[#0a0a0c] mb-4">Informations</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Client *</label>
                <select className="field" value={form.client} onChange={(e) => update('client', e.target.value)} required>
                  <option value="">— Sélectionner —</option>
                  {clients.map((c) => <option key={c._id} value={c._id}>{c.nom}{c.entreprise ? ` (${c.entreprise})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Objet</label>
                <input className="field" value={form.objet} onChange={(e) => update('objet', e.target.value)} placeholder="Ex: Prestation de design" />
              </div>
              <div>
                <label className="field-label">Date d'émission</label>
                <input type="date" className="field" value={form.dateEmission} onChange={(e) => update('dateEmission', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Date d'échéance</label>
                <input type="date" className="field" value={form.dateEcheance} onChange={(e) => update('dateEcheance', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Articles */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#0a0a0c]">Articles</h3>
              <button type="button" onClick={addItem} className="btn-ghost text-xs py-1.5"><Plus size={14} /> Ajouter une ligne</button>
            </div>

            <div className="space-y-3">
              {form.items.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-gray-100 bg-white/40">
                  <div className="flex items-center gap-2 mb-2">
                    <GripVertical size={16} className="text-gray-300 shrink-0" />
                    <span className="text-xs font-bold text-gray-400">Ligne {idx + 1}</span>
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="ml-auto text-gray-400 hover:text-[#d9524d]">
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
                    <div className="sm:col-span-2 flex items-center font-semibold text-[#0a0a0c] text-sm">
                      {formatFCFA(item.quantite * item.prixUnitaire)}
                    </div>
                  </div>
                  {services.length > 0 && (
                    <div className="mt-2">
                      <select className="field text-xs py-1" value="" onChange={(e) => pickService(idx, e.target.value)}>
                        <option value="">Pré-remplir depuis un service...</option>
                        {services.map((s) => <option key={s._id} value={s._id}>{s.nom} — {formatFCFA(s.prix)}</option>)}
                      </select>
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
        </div>

        {/* Sidebar totaux */}
        <div className="space-y-6">
          <div className="glass-card p-6 sticky top-6">
            <h3 className="font-bold text-[#0a0a0c] mb-4">Totaux</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sous-total</span>
                <span className="font-semibold">{formatFCFA(form.items.reduce((s, i) => s + i.quantite * i.prixUnitaire, 0))}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Remise (FCFA)</span>
                <input type="number" min={0} className="field w-28 text-right py-1" value={form.remise}
                  onChange={(e) => update('remise', Number(e.target.value))} />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">TVA (%)</span>
                <input type="number" min={0} className="field w-28 text-right py-1" value={form.tva}
                  onChange={(e) => update('tva', Number(e.target.value))} />
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <span className="text-gray-500">Total HT</span>
                <span className="font-semibold">{formatFCFA(ht)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">TVA</span>
                <span className="font-semibold">{formatFCFA(ht * form.tva / 100)}</span>
              </div>
              <div className="rounded-xl p-3 mt-3 text-white"
                style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}>
                <p className="text-xs text-gray-300 uppercase">Total TTC</p>
                <p className="text-xl font-extrabold">{formatFCFA(ttc)}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
                {saving && <span className="spinner" style={{ width: 16, height: 16 }} />}
                <Save size={18} /> {isEdit ? 'Mettre à jour' : 'Enregistrer (brouillon)'}
              </button>
              <button type="button" onClick={(e) => handleSubmit(e as unknown as React.FormEvent, 'envoyee')}
                className="btn-dark w-full justify-center" disabled={saving}>
                Enregistrer & Marquer envoyée
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
