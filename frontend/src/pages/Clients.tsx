import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, Search, Pencil, Trash2, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import { getClients, deleteClient } from '../api/clients';
import type { Client } from '../types';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import { apiError } from '../utils/format';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    getClients()
      .then((res) => setClients(res.data))
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return c.nom.toLowerCase().includes(q) ||
      (c.entreprise || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q);
  });

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteClient(toDelete._id);
      toast('Client supprimé');
      setToDelete(null);
      load();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client(s) au total`}
        icon={<Users size={20} />}
        actions={
          <Link to="/app/clients/new" className="btn-primary text-sm">
            <Plus size={18} /> Ajouter un client
          </Link>
        }
      />

      {/* Recherche */}
      <div className="glass-card p-4 mb-6 animate-fade-up">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, entreprise, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title={search ? 'Aucun résultat' : 'Aucun client'}
          description={search ? 'Essayez une autre recherche.' : 'Commencez par ajouter votre premier client.'}
          action={!search && <Link to="/app/clients/new" className="btn-primary"><Plus size={18} /> Ajouter un client</Link>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <div key={c._id} className="glass-card p-5 animate-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg,#e11d2a,#b3121d)' }}>
                  {c.nom.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#0a0a0c] truncate">{c.nom}</p>
                  {c.entreprise && <p className="text-xs text-gray-500 truncate">{c.entreprise}</p>}
                </div>
              </div>

              <div className="space-y-1.5 text-sm text-gray-600 mb-4">
                {c.email && <p className="flex items-center gap-2 truncate"><Mail size={14} className="text-gray-400 shrink-0" /> {c.email}</p>}
                {c.telephone && <p className="flex items-center gap-2"><Phone size={14} className="text-gray-400 shrink-0" /> {c.telephone}</p>}
                {c.adresse && <p className="flex items-center gap-2 truncate"><MapPin size={14} className="text-gray-400 shrink-0" /> {c.adresse}</p>}
                {!c.email && !c.telephone && !c.adresse && <p className="text-gray-400 italic text-xs">Aucune coordonnée</p>}
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <Link to={`/app/clients/${c._id}/edit`} className="btn-icon" title="Modifier">
                  <Pencil size={16} />
                </Link>
                <button className="btn-icon" onClick={() => setToDelete(c)} title="Supprimer">
                  <Trash2 size={16} />
                </button>
                <Link to={`/app/invoices/new?client=${c._id}`} className="btn-ghost text-xs ml-auto py-1.5">
                  <Building2 size={14} /> Facturer
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer le client"
        message={`Êtes-vous sûr de vouloir supprimer "${toDelete?.nom}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
