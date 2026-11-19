import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Pencil, Trash2, Search, Tag, Zap, Lock, Boxes, AlertTriangle, ArrowDownUp } from 'lucide-react';
import { getServices, getUnites, createService, updateService, deleteService, mouvementStock, getStockResume, type StockResume, type MouvementType } from '../api/services';
import { getAllClients } from '../api/clients';
import { createInvoiceFromService } from '../api/invoices';
import type { Service, Client } from '../types';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import InfoHint from '../components/ui/InfoHint';
import Select from '../components/ui/Select';
import DatePicker from '../components/ui/DatePicker';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useToast } from '../contexts/ToastContext';
import { formatFCFA, apiError, todayISO } from '../utils/format';

const EMPTY = { nom: '', description: '', prix: 0, unite: 'unité', suiviStock: false, stock: 0, seuilAlerte: 0, prixAchat: 0 };

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [unites, setUnites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const navigate = useNavigate();
  // Toujours la même règle que le serveur (voir requireFeature('facturationExpress')
  // sur la route /invoices/from-service) — jamais un raccourci recalculé ici
  // qui pourrait diverger (ex: ignorer l'expiration de l'abonnement).
  const peutFacturerExpress = !!permissions?.peutUtiliserFacturationExpress;

  // Facturation rapide (premium)
  const [invoiceModal, setInvoiceModal] = useState<Service | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoiceForm, setInvoiceForm] = useState({ clientId: '', quantite: 1, prixUnitaire: 0, dateEcheance: todayISO() });
  const [invoicing, setInvoicing] = useState(false);

  const load = () => {
    setLoading(true);
    getServices()
      .then((res) => setServices(res.data))
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  const peutStock = !!permissions?.peutGererStock;
  const [resume, setResume] = useState<StockResume | null>(null);
  const [mouvement, setMouvement] = useState<Service | null>(null);
  const [mvt, setMvt] = useState<{ type: MouvementType; quantite: number; note: string }>({ type: 'entree', quantite: 1, note: '' });
  const [mvtSaving, setMvtSaving] = useState(false);
  const loadResume = () => { if (peutStock) getStockResume().then((r) => setResume(r.data)).catch(() => {}); };
  useEffect(loadResume, [peutStock]);

  const ouvrirMouvement = (s: Service) => { setMvt({ type: 'entree', quantite: 1, note: '' }); setMouvement(s); };
  const validerMouvement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mouvement) return;
    setMvtSaving(true);
    try {
      await mouvementStock(mouvement._id, mvt);
      toast('Stock mis à jour');
      setMouvement(null);
      load();
      loadResume();
    } catch (err) { toast(apiError(err), 'error'); } finally { setMvtSaving(false); }
  };
  useEffect(() => { getUnites().then((res) => setUnites(res.data.unites)).catch(() => {}); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({ nom: s.nom, description: s.description || '', prix: s.prix, unite: s.unite || 'unité', suiviStock: !!s.suiviStock, stock: s.stock ?? 0, seuilAlerte: s.seuilAlerte ?? 0, prixAchat: s.prixAchat ?? 0 });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const { stock: _stock, ...sansStock } = form;
        void _stock;
        await updateService(editing._id, sansStock);
        toast('Service mis à jour');
      } else {
        await createService(form);
        toast('Service créé');
      }
      setModalOpen(false);
      load();
      if (!unites.includes(form.unite)) getUnites().then((res) => setUnites(res.data.unites)).catch(() => {});
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openInvoiceModal = (s: Service) => {
    if (!peutFacturerExpress) {
      toast('Fonctionnalité réservée aux comptes Pro/Business. Découvrez les abonnements.', 'error');
      navigate('/app/abonnement');
      return;
    }
    if (clients.length === 0) {
      getAllClients().then((res) => setClients(res.data.items)).catch((err) => toast(apiError(err), 'error'));
    }
    setInvoiceForm({ clientId: '', quantite: 1, prixUnitaire: s.prix, dateEcheance: todayISO() });
    setInvoiceModal(s);
  };

  const handleQuickInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceModal || !invoiceForm.clientId) return;
    setInvoicing(true);
    try {
      const res = await createInvoiceFromService({
        serviceId: invoiceModal._id,
        clientId: invoiceForm.clientId,
        quantite: invoiceForm.quantite,
        prixUnitaire: invoiceForm.prixUnitaire,
        dateEcheance: invoiceForm.dateEcheance,
      });
      toast('Facture créée');
      setInvoiceModal(null);
      navigate(`/app/invoices/${res.data._id}`);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setInvoicing(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteService(toDelete._id);
      toast('Service supprimé');
      setToDelete(null);
      load();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = services.filter((s) => s.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Produits & Services"
        subtitle={<>
          {services.length} tarif(s) préconçu(s) — homogènes pour vos prestations courantes, ajustables au cas par cas
          <InfoHint text="Créez ici vos tarifs standards (ex: 'Création de logo — 50 000 FCFA'). Vous pourrez toujours ajuster le prix pour un client précis lors de la facturation, sans changer le tarif de base." />
        </>}
        icon={<Package size={20} />}
        actions={<button onClick={openCreate} className="btn-primary text-sm"><Plus size={18} /> Nouveau</button>}
      />

      {peutStock && resume && resume.nombreProduits > 0 && (
        <div className="grid sm:grid-cols-3 gap-4 mb-6 fx-stagger">
          <div className="glass-card p-5 stat-tone-mint">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Valeur du stock (achat)</p>
            <p className="text-2xl font-extrabold mt-3 tabular-nums">{formatFCFA(resume.valeurAchat)}</p>
            <p className="text-xs text-gray-500 mt-1">À la vente : {formatFCFA(resume.valeurVente)}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Stock bas</p>
            <p className="text-2xl font-extrabold mt-3 text-[#f59e0b]">{resume.enAlerte.length}</p>
            <p className="text-xs text-gray-500 mt-1 truncate">{resume.enAlerte.map((p) => p.nom).join(', ') || 'Aucun produit en alerte'}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Épuisés</p>
            <p className="text-2xl font-extrabold mt-3 text-[#d9524d]">{resume.epuises.length}</p>
            <p className="text-xs text-gray-500 mt-1 truncate">{resume.epuises.map((p) => p.nom).join(', ') || 'Rien d’épuisé'}</p>
          </div>
        </div>
      )}

      <div className="glass-card p-4 mb-6 animate-fade-up">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input className="field pl-10" placeholder="Rechercher un service..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package size={28} />}
          title={search ? 'Aucun résultat' : 'Aucun service'}
          description={search ? 'Essayez une autre recherche.' : 'Créez vos produits et services pour les réutiliser dans vos factures.'}
          action={!search && <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Créer un service</button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s, i) => (
            <div key={s._id} className="glass-card p-5 animate-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}>
                  <Tag size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#0a0a0c] dark:text-white truncate">{s.nom}</p>
                  {s.description && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{s.description}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/10">
                <div>
                  <p className="text-lg font-extrabold text-[#d9524d]">{formatFCFA(s.prix)}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">/ {s.unite}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-icon" onClick={() => openEdit(s)}><Pencil size={15} /></button>
                  <button className="btn-icon" onClick={() => setToDelete(s)}><Trash2 size={15} /></button>
                </div>
              </div>
              {s.suiviStock && (
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className={`inline-flex items-center gap-1.5 font-semibold ${(s.stock ?? 0) <= 0 ? 'text-[#d9524d]' : (s.stock ?? 0) <= (s.seuilAlerte ?? 0) ? 'text-[#f59e0b]' : 'text-[#10b981]'}`}>
                    {(s.stock ?? 0) <= (s.seuilAlerte ?? 0) ? <AlertTriangle size={13} /> : <Boxes size={13} />}
                    {s.stock ?? 0} {s.unite} en stock
                  </span>
                  <button type="button" className="btn-ghost text-xs px-2 py-1" onClick={() => ouvrirMouvement(s)}><ArrowDownUp size={12} /> Mouvement</button>
                </div>
              )}
              <button
                onClick={() => openInvoiceModal(s)}
                className="btn-dark text-xs w-full justify-center mt-3 py-2"
              >
                {peutFacturerExpress ? <Zap size={13} /> : <Lock size={13} />} Facturer directement à un client</button>
            </div>
          ))}
        </div>
      )}

      {/* Modal create/edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le service' : 'Nouveau service'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">Nom *</label>
            <input className="field" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required autoFocus
              placeholder="Ex: Création site web" />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea className="field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Prix (FCFA) *</label>
              <input type="number" min={0} className="field" value={form.prix} onChange={(e) => setForm({ ...form, prix: Number(e.target.value) })} required />
            </div>
            <div>
              <label className="field-label">Unité</label>
              <Select
                value={form.unite}
                onChange={(v) => setForm({ ...form, unite: v })}
                options={unites.map((u) => ({ value: u, label: u }))}
                allowCustom
                customPlaceholder="Autre unité..."
                placeholder="Choisir une unité"
              />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={form.suiviStock} disabled={!peutStock && !form.suiviStock}
                onChange={(e) => setForm({ ...form, suiviStock: e.target.checked })} />
              Suivre le stock de ce produit
              {!peutStock && <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500">Pro</span>}
            </label>
            {form.suiviStock && (
              <div className="grid grid-cols-3 gap-3">
                {!editing && (
                  <div>
                    <label className="field-label">Stock initial</label>
                    <input type="number" className="field" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
                  </div>
                )}
                <div>
                  <label className="field-label">Alerte à</label>
                  <input type="number" min={0} className="field" value={form.seuilAlerte} onChange={(e) => setForm({ ...form, seuilAlerte: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="field-label">Prix d’achat</label>
                  <input type="number" min={0} className="field" value={form.prixAchat} onChange={(e) => setForm({ ...form, prixAchat: Number(e.target.value) })} />
                </div>
              </div>
            )}
            {form.suiviStock && <p className="text-xs text-gray-500">Le stock baisse tout seul à chaque facture envoyée ou payée, et remonte si elle est annulée.</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="spinner" style={{ width: 16, height: 16 }} />}
              {editing ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!mouvement} onClose={() => setMouvement(null)} title={`Stock : ${mouvement?.nom ?? ''}`}>
        <form onSubmit={validerMouvement} className="space-y-4">
          <p className="text-sm text-gray-500">En stock actuellement : <b>{mouvement?.stock ?? 0} {mouvement?.unite}</b></p>
          <div className="grid grid-cols-3 gap-2">
            {([['entree', 'Entrée'], ['sortie', 'Sortie'], ['ajustement', 'Inventaire']] as [MouvementType, string][]).map(([t, l]) => (
              <button key={t} type="button" onClick={() => setMvt({ ...mvt, type: t })}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-soft ${mvt.type === t ? 'bg-[#14151a] text-white border-[#14151a]' : 'border-gray-200 dark:border-white/15'}`}>{l}</button>
            ))}
          </div>
          <div>
            <label className="field-label">{mvt.type === 'ajustement' ? 'Quantité réellement comptée' : 'Quantité'}</label>
            <input type="number" min={mvt.type === 'ajustement' ? 0 : 1} className="field" value={mvt.quantite} onChange={(e) => setMvt({ ...mvt, quantite: Number(e.target.value) })} />
          </div>
          <div>
            <label className="field-label">Note</label>
            <input className="field" value={mvt.note} onChange={(e) => setMvt({ ...mvt, note: e.target.value })} placeholder="Ex. livraison fournisseur, casse..." />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setMouvement(null)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={mvtSaving}>{mvtSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>

      {/* Facturation rapide depuis un tarif préconçu (premium) */}
      <Modal open={!!invoiceModal} onClose={() => setInvoiceModal(null)} title={`Facturer "${invoiceModal?.nom}"`}>
        <form onSubmit={handleQuickInvoice} className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
            Le tarif de base reste inchangé dans votre catalogue — seule cette facture utilise le prix ci-dessous.
          </p>
          <div>
            <label className="field-label">Client *</label>
            <Select value={invoiceForm.clientId} onChange={(v) => setInvoiceForm({ ...invoiceForm, clientId: v })} options={[{value:'',label:'Sélectionner...'}, ...clients.map(c => ({value:c._id,label:`${c.nom}${c.entreprise ? ` — ${c.entreprise}` : ''}`}))]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Quantité</label>
              <input type="number" min={1} className="field" value={invoiceForm.quantite}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, quantite: Number(e.target.value) })} />
            </div>
            <div>
              <label className="field-label">Prix unitaire (FCFA)
                <InfoHint text="Pré-rempli avec votre tarif préconçu — modifiez-le librement pour ce client précis si besoin." />
              </label>
              <input type="number" min={0} className="field" value={invoiceForm.prixUnitaire}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, prixUnitaire: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="field-label">Échéance</label>
            <DatePicker value={invoiceForm.dateEcheance} onChange={(v) => setInvoiceForm({ ...invoiceForm, dateEcheance: v })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setInvoiceModal(null)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={invoicing || !invoiceForm.clientId}>
              {invoicing && <span className="spinner" style={{ width: 16, height: 16 }} />} Créer la facture
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer le service"
        message={`Supprimer "${toDelete?.nom}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
