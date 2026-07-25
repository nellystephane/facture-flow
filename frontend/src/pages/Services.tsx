import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Pencil, Trash2, Search, Tag, Zap, Lock } from 'lucide-react';
import { getServices, createService, updateService, deleteService } from '../api/services';
import { getClients } from '../api/clients';
import { createInvoiceFromService } from '../api/invoices';
import type { Service, Client } from '../types';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import InfoHint from '../components/ui/InfoHint';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatFCFA, apiError, todayISO } from '../utils/format';

const EMPTY = { nom: '', description: '', prix: 0, unite: 'unité' };

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
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
  const navigate = useNavigate();
  const estPremium = !!user?.subscription && user.subscription !== 'gratuit';

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

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({ nom: s.nom, description: s.description || '', prix: s.prix, unite: s.unite || 'unité' });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateService(editing._id, form);
        toast('Service mis à jour');
      } else {
        await createService(form);
        toast('Service créé');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openInvoiceModal = (s: Service) => {
    if (!estPremium) {
      toast('Fonctionnalité réservée aux comptes Pro/Business. Découvrez les abonnements.', 'error');
      navigate('/app/abonnement');
      return;
    }
    if (clients.length === 0) {
      getClients().then((res) => setClients(res.data)).catch((err) => toast(apiError(err), 'error'));
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

      <div className="glass-card p-4 mb-6 animate-fade-up">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                  <p className="font-bold text-[#0a0a0c] truncate">{s.nom}</p>
                  {s.description && <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{s.description}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div>
                  <p className="text-lg font-extrabold text-[#d9524d]">{formatFCFA(s.prix)}</p>
                  <p className="text-[10px] text-gray-400 uppercase">/ {s.unite}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-icon" onClick={() => openEdit(s)}><Pencil size={15} /></button>
                  <button className="btn-icon" onClick={() => setToDelete(s)}><Trash2 size={15} /></button>
                </div>
              </div>
              <button
                onClick={() => openInvoiceModal(s)}
                className="btn-dark text-xs w-full justify-center mt-3 py-2"
              >
                {estPremium ? <Zap size={13} /> : <Lock size={13} />} Facturer directement à un client</button>
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
              <input className="field" value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} placeholder="unité, heure, jour..." />
            </div>
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

      {/* Facturation rapide depuis un tarif préconçu (premium) */}
      <Modal open={!!invoiceModal} onClose={() => setInvoiceModal(null)} title={`Facturer "${invoiceModal?.nom}"`}>
        <form onSubmit={handleQuickInvoice} className="space-y-4">
          <p className="text-xs text-gray-500 -mt-1">
            Le tarif de base reste inchangé dans votre catalogue — seule cette facture utilise le prix ci-dessous.
          </p>
          <div>
            <label className="field-label">Client *</label>
            <select className="field" value={invoiceForm.clientId} onChange={(e) => setInvoiceForm({ ...invoiceForm, clientId: e.target.value })} required autoFocus>
              <option value="">Sélectionner...</option>
              {clients.map((c) => <option key={c._id} value={c._id}>{c.nom}{c.entreprise ? ` — ${c.entreprise}` : ''}</option>)}
            </select>
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
            <input type="date" className="field" value={invoiceForm.dateEcheance}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, dateEcheance: e.target.value })} />
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
