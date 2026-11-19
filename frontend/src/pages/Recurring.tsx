import { useEffect, useState, type FormEvent } from 'react';
import { Repeat, Plus, Pencil, Trash2, Pause, Play, Mail, AlertTriangle } from 'lucide-react';
import {
  getRecurring, createRecurring, updateRecurring, setRecurringActif, deleteRecurring,
  FREQUENCE_LABEL, type Recurring as RecurringT, type Frequence, type RecurringItem,
} from '../api/recurring';
import { getAllClients } from '../api/clients';
import type { Client } from '../types';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import LockedFeature from '../components/ui/LockedFeature';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import { usePermissions } from '../contexts/PermissionsContext';
import DeviseField from '../components/DeviseField';
import { apiError, formatFCFA, formatDate, todayISO } from '../utils/format';

interface FormState {
  client: string;
  titre: string;
  items: RecurringItem[];
  frequence: Frequence;
  prochaineEmission: string;
  dateFin: string;
  delaiEcheanceJours: number;
  envoiAutomatique: boolean;
  tva: number;
  notes: string;
  devise: string;
  tauxChange: number;
}

const emptyForm = (): FormState => ({
  client: '', titre: '', items: [{ description: '', quantite: 1, prixUnitaire: 0 }], frequence: 'mensuelle',
  prochaineEmission: todayISO(), dateFin: '', delaiEcheanceJours: 15, envoiAutomatique: false, tva: 0, notes: '',
  devise: 'XOF', tauxChange: 1,
});

const totalHT = (items: RecurringItem[]) => items.reduce((s, i) => s + i.quantite * i.prixUnitaire, 0);
const clientNom = (c: RecurringT['client']) => (typeof c === 'string' ? '' : c?.nom || 'Client supprimé');
const clientId = (c: RecurringT['client']) => (typeof c === 'string' ? c : c?._id || '');

export default function Recurring() {
  const { permissions } = usePermissions();
  const { toast } = useToast();
  const [items, setItems] = useState<RecurringT[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringT | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<RecurringT | null>(null);
  const autorise = !!permissions?.peutUtiliserFacturesRecurrentes;

  const load = () => {
    setLoading(true);
    getRecurring().then((r) => setItems(r.data)).catch((e) => toast(apiError(e), 'error')).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!permissions) return;
    if (!autorise) { setLoading(false); return; }
    load();
    getAllClients().then((r) => setClients(r.data.items)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorise, permissions]);

  if (permissions && !autorise) {
    return (
      <div>
        <PageHeader title="Factures récurrentes" subtitle="Une facture qui se crée toute seule" icon={<Repeat size={20} />} />
        <LockedFeature icon={<Repeat size={22} />} titre="Factures récurrentes"
          description="Programmez une facture qui se crée toute seule chaque semaine, mois ou année : abonnements, loyers, maintenance." />
      </div>
    );
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (r: RecurringT) => {
    setEditing(r);
    setForm({
      client: clientId(r.client), titre: r.titre, items: r.items.map((i) => ({ ...i })), frequence: r.frequence,
      prochaineEmission: r.prochaineEmission.slice(0, 10), dateFin: r.dateFin ? r.dateFin.slice(0, 10) : '',
      delaiEcheanceJours: r.delaiEcheanceJours, envoiAutomatique: r.envoiAutomatique, tva: r.tva, notes: r.notes || '',
      devise: r.devise || 'XOF', tauxChange: r.tauxChange || 1,
    });
    setFormOpen(true);
  };

  const setItem = (idx: number, patch: Partial<RecurringItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.client) { toast('Choisissez un client', 'error'); return; }
    if (!form.titre.trim()) { toast('Donnez un nom à cette facture récurrente', 'error'); return; }
    if (form.items.some((i) => !i.description.trim())) { toast('Chaque ligne doit avoir une description', 'error'); return; }
    setSaving(true);
    const payload = {
      client: form.client, titre: form.titre.trim(), items: form.items, frequence: form.frequence,
      prochaineEmission: form.prochaineEmission, dateFin: form.dateFin || null,
      delaiEcheanceJours: form.delaiEcheanceJours, envoiAutomatique: form.envoiAutomatique, tva: form.tva, notes: form.notes,
      devise: form.devise, tauxChange: form.tauxChange,
    };
    try {
      if (editing) await updateRecurring(editing._id, payload);
      else await createRecurring(payload);
      toast(editing ? 'Facture récurrente modifiée' : 'Facture récurrente programmée');
      setFormOpen(false);
      load();
    } catch (err) { toast(apiError(err), 'error'); } finally { setSaving(false); }
  };

  const toggle = async (r: RecurringT) => {
    try { await setRecurringActif(r._id, !r.actif); load(); } catch (err) { toast(apiError(err), 'error'); }
  };
  const remove = async () => {
    if (!toDelete) return;
    try { await deleteRecurring(toDelete._id); toast('Supprimée'); setToDelete(null); load(); } catch (err) { toast(apiError(err), 'error'); }
  };

  return (
    <div>
      <PageHeader
        title="Factures récurrentes"
        subtitle="Programmez une fois, Oryxa crée la facture à chaque échéance"
        icon={<Repeat size={20} />}
        actions={<button className="btn-primary text-sm" onClick={openCreate}><Plus size={18} /> Nouvelle récurrence</button>}
      />

      {loading ? <div className="h-48 skeleton" /> : items.length === 0 ? (
        <EmptyState icon={<Repeat size={28} />} title="Aucune facture récurrente"
          description="Idéal pour un abonnement, un loyer ou un contrat de maintenance facturés à intervalle fixe."
          action={<button className="btn-primary" onClick={openCreate}><Plus size={18} /> Programmer une facture</button>} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4 fx-stagger">
          {items.map((r) => (
            <div key={r._id} className={`glass-card p-5 ${r.actif ? '' : 'opacity-70'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#0a0a0c] dark:text-white truncate">{r.titre}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{clientNom(r.client)} · {FREQUENCE_LABEL[r.frequence]}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${r.actif ? 'bg-[#dcefe6] text-[#0f7a55]' : 'bg-gray-100 text-gray-500'}`}>{r.actif ? 'Active' : 'En pause'}</span>
              </div>
              <p className="text-2xl font-extrabold mt-4 tabular-nums">{formatFCFA(totalHT(r.items), r.devise)}<span className="text-xs font-medium text-gray-400"> HT</span></p>
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p>{r.actif ? `Prochaine facture : ${formatDate(r.prochaineEmission)}` : 'Aucune facture ne sera créée tant qu’elle est en pause'}</p>
                <p>{r.nombreGenerees} facture(s) créée(s){r.dateFin ? ` · fin le ${formatDate(r.dateFin)}` : ''}</p>
                {r.envoiAutomatique && <p className="flex items-center gap-1.5"><Mail size={12} /> Envoyée automatiquement par e-mail</p>}
              </div>
              {r.derniereErreur && (
                <p className="mt-3 text-xs rounded-lg bg-[rgba(217,82,77,0.08)] text-[#b23c37] px-3 py-2 flex gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {r.derniereErreur}</p>
              )}
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
                <button className="btn-ghost text-xs" onClick={() => toggle(r)}>{r.actif ? <><Pause size={13} /> Mettre en pause</> : <><Play size={13} /> Reprendre</>}</button>
                <button className="btn-icon" onClick={() => openEdit(r)} title="Modifier"><Pencil size={15} /></button>
                <button className="btn-icon" onClick={() => setToDelete(r)} title="Supprimer"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Modifier la récurrence' : 'Nouvelle facture récurrente'} size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Nom *</label>
              <input className="field" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Ex. Maintenance mensuelle" autoFocus />
            </div>
            <div>
              <label className="field-label">Client *</label>
              <select className="field" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
                <option value="">Sélectionner...</option>
                {clients.map((c) => <option key={c._id} value={c._id}>{c.nom}{c.entreprise ? ` — ${c.entreprise}` : ''}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="field-label">Lignes de la facture</label>
            {form.items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_70px_110px_auto] gap-2 items-center">
                <input className="field" placeholder="Description" value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} />
                <input className="field" type="number" min={1} value={it.quantite} onChange={(e) => setItem(idx, { quantite: Number(e.target.value) })} aria-label="Quantité" />
                <input className="field" type="number" min={0} value={it.prixUnitaire} onChange={(e) => setItem(idx, { prixUnitaire: Number(e.target.value) })} aria-label="Prix unitaire" />
                <button type="button" className="btn-icon" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" className="btn-ghost text-xs" onClick={() => setForm({ ...form, items: [...form.items, { description: '', quantite: 1, prixUnitaire: 0 }] })}><Plus size={13} /> Ajouter une ligne</button>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="field-label">Répétition</label>
              <select className="field" value={form.frequence} onChange={(e) => setForm({ ...form, frequence: e.target.value as Frequence })}>
                {(Object.keys(FREQUENCE_LABEL) as Frequence[]).map((f) => <option key={f} value={f}>{FREQUENCE_LABEL[f]}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Première facture le</label>
              <input className="field" type="date" min={editing ? undefined : todayISO()} value={form.prochaineEmission} onChange={(e) => setForm({ ...form, prochaineEmission: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Fin (optionnel)</label>
              <input className="field" type="date" value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Échéance après (jours)</label>
              <input className="field" type="number" min={0} value={form.delaiEcheanceJours} onChange={(e) => setForm({ ...form, delaiEcheanceJours: Number(e.target.value) })} />
            </div>
            <div>
              <label className="field-label">TVA (%)</label>
              <input className="field" type="number" min={0} max={100} value={form.tva} onChange={(e) => setForm({ ...form, tva: Number(e.target.value) })} />
            </div>
          </div>
          <DeviseField devise={form.devise} tauxChange={form.tauxChange} onChange={(d) => setForm((f) => ({ ...f, ...d }))} />
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1" checked={form.envoiAutomatique} onChange={(e) => setForm({ ...form, envoiAutomatique: e.target.checked })} />
            <span>Envoyer la facture au client par e-mail dès sa création<br /><span className="text-xs text-gray-500">Sinon elle est créée en brouillon, à vous de l’envoyer.</span></span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!toDelete} title="Supprimer la récurrence"
        message={`Supprimer « ${toDelete?.titre} » ? Les factures déjà créées sont conservées.`}
        confirmLabel="Supprimer" onConfirm={remove} onClose={() => setToDelete(null)} />
    </div>
  );
}
