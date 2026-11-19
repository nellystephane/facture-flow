import { useEffect, useState, type FormEvent } from 'react';
import { Receipt, Plus, Search, Pencil, Trash2, CalendarDays, Tag, Wallet } from 'lucide-react';
import {
  getExpenses, getExpensesSummary, createExpense, updateExpense, deleteExpense,
  EXPENSE_CATEGORIE_LABEL,
  type Expense, type ExpenseCategorie, type ExpenseMethode, type ExpensesSummary,
} from '../api/expenses';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import ChartButton from '../components/charts/ChartButton';
import { useToast } from '../contexts/ToastContext';
import { apiError, formatFCFA, formatDate, formatCompact, todayISO, METHODE_LABEL } from '../utils/format';

interface FormState {
  libelle: string;
  montant: string;
  categorie: ExpenseCategorie;
  date: string;
  fournisseur: string;
  methode: ExpenseMethode;
  note: string;
}

const emptyForm = (): FormState => ({
  libelle: '', montant: '', categorie: 'autre', date: todayISO(), fournisseur: '', methode: 'especes', note: '',
});

const CATEGORIES = Object.keys(EXPENSE_CATEGORIE_LABEL) as ExpenseCategorie[];
const METHODES = Object.keys(METHODE_LABEL) as ExpenseMethode[];

export default function Expenses() {
  const [items, setItems] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpensesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categorie, setCategorie] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    getExpenses({ page, limit: 20, q: search || undefined, categorie: categorie || undefined })
      .then((res) => {
        setItems(res.data.items);
        setTotalPages(res.data.totalPages);
        setTotal(res.data.total);
      })
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  };
  const loadSummary = () => { getExpensesSummary().then((r) => setSummary(r.data)).catch(() => {}); };

  useEffect(load, [page, categorie]);
  useEffect(loadSummary, []);
  useEffect(() => {
    const t = setTimeout(() => { if (page !== 1) setPage(1); else load(); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      libelle: e.libelle, montant: String(e.montant), categorie: e.categorie, date: e.date.slice(0, 10),
      fournisseur: e.fournisseur || '', methode: e.methode, note: e.note || '',
    });
    setFormOpen(true);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const montant = Number(form.montant);
    if (!form.libelle.trim()) { toast('Le libellé est requis', 'error'); return; }
    if (!Number.isFinite(montant) || montant <= 0) { toast('Le montant doit être supérieur à 0', 'error'); return; }
    setSaving(true);
    const payload = { ...form, libelle: form.libelle.trim(), montant, fournisseur: form.fournisseur.trim(), note: form.note.trim() };
    try {
      if (editing) await updateExpense(editing._id, payload);
      else await createExpense(payload);
      toast(editing ? 'Dépense modifiée' : 'Dépense enregistrée');
      setFormOpen(false);
      load();
      loadSummary();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteExpense(toDelete._id);
      toast('Dépense supprimée');
      setToDelete(null);
      load();
      loadSummary();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Dépenses"
        subtitle="Ce que votre activité vous coûte, pour connaître votre vrai bénéfice"
        icon={<Receipt size={20} />}
        actions={
          <>
            <ChartButton metrics={['depenses', 'encaissements', 'depenses_categories']} title="Analyser les dépenses" />
            <button onClick={openCreate} className="btn-primary text-sm"><Plus size={18} /> Nouvelle dépense</button>
          </>
        }
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6 fx-stagger">
        <StatCard label="Dépenses du mois" value={formatCompact(summary?.totalMois ?? 0)} icon={<CalendarDays size={22} />} accent="rouge" tone="mint" trend={summary ? `${summary.nombreMois} ligne(s) ce mois` : undefined} />
        <StatCard label="Total enregistré" value={formatCompact(summary?.totalGlobal ?? 0)} icon={<Wallet size={22} />} accent="noir" trend={summary ? `${summary.nombreGlobal} dépense(s)` : undefined} />
        <StatCard label="Poste principal du mois" value={summary?.categoriePrincipaleMois ? EXPENSE_CATEGORIE_LABEL[summary.categoriePrincipaleMois] : '—'} icon={<Tag size={22} />} accent="bleu" />
      </div>

      <div className="glass-card p-4 mb-6 animate-fade-up">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input className="field pl-10" placeholder="Rechercher un libellé ou un fournisseur..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="field sm:w-56" value={categorie} onChange={(e) => { setPage(1); setCategorie(e.target.value); }} aria-label="Catégorie">
            <option value="">Toutes les catégories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORIE_LABEL[c]}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-64 skeleton" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Receipt size={28} />}
          title={search || categorie ? 'Aucun résultat' : 'Aucune dépense'}
          description={search || categorie ? 'Essayez un autre filtre.' : 'Notez vos achats et vos charges pour voir ce qu’il vous reste vraiment.'}
          action={!search && !categorie && <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Ajouter une dépense</button>}
        />
      ) : (
        <div className="glass-card p-2 sm:p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 dark:text-gray-500 uppercase border-b border-gray-100 dark:border-white/10">
                <th className="px-3 pb-3 font-semibold">Date</th>
                <th className="px-3 pb-3 font-semibold">Libellé</th>
                <th className="px-3 pb-3 font-semibold hidden sm:table-cell">Catégorie</th>
                <th className="px-3 pb-3 font-semibold hidden md:table-cell">Moyen</th>
                <th className="px-3 pb-3 font-semibold text-right">Montant</th>
                <th className="px-3 pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/10">
              {items.map((e) => (
                <tr key={e._id} className="hover:bg-gray-50/70 dark:hover:bg-white/5 transition-soft">
                  <td className="px-3 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">{formatDate(e.date)}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-[#0a0a0c] dark:text-white">{e.libelle}</p>
                    {e.fournisseur && <p className="text-xs text-gray-400 dark:text-gray-500">{e.fournisseur}</p>}
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell text-gray-600 dark:text-gray-300">{EXPENSE_CATEGORIE_LABEL[e.categorie]}</td>
                  <td className="px-3 py-3 hidden md:table-cell text-gray-600 dark:text-gray-300">{METHODE_LABEL[e.methode]}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums whitespace-nowrap">{formatFCFA(e.montant)}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 justify-end">
                      <button className="btn-icon" onClick={() => openEdit(e)} title="Modifier"><Pencil size={15} /></button>
                      <button className="btn-icon" onClick={() => setToDelete(e)} title="Supprimer"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="field-label">Libellé *</label>
            <input className="field" value={form.libelle} onChange={(e) => set('libelle', e.target.value)} placeholder="Ex. Loyer du local, achat de tissu..." autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Montant (FCFA) *</label>
              <input className="field" type="number" inputMode="numeric" min="0" value={form.montant} onChange={(e) => set('montant', e.target.value)} />
            </div>
            <div>
              <label className="field-label">Date</label>
              <input className="field" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Catégorie</label>
              <select className="field" value={form.categorie} onChange={(e) => set('categorie', e.target.value as ExpenseCategorie)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORIE_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Payé avec</label>
              <select className="field" value={form.methode} onChange={(e) => set('methode', e.target.value as ExpenseMethode)}>
                {METHODES.map((m) => <option key={m} value={m}>{METHODE_LABEL[m]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">Fournisseur</label>
            <input className="field" value={form.fournisseur} onChange={(e) => set('fournisseur', e.target.value)} />
          </div>
          <div>
            <label className="field-label">Note</label>
            <textarea className="field" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer la dépense"
        message={`Supprimer « ${toDelete?.libelle} » ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
