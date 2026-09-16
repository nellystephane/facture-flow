import { useEffect, useState } from 'react';
import { Users, UserPlus, Trash2, Loader2, ShieldCheck, History } from 'lucide-react';
import { getMembers, inviteMember, updateMemberRole, removeMember, getActivity } from '../api/team';
import { usePermissions } from '../contexts/PermissionsContext';
import { useToast } from '../contexts/ToastContext';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import LockedFeature from '../components/ui/LockedFeature';
import { apiError } from '../utils/format';
import type { TeamMember, ActivityLogEntry } from '../types';

export default function Equipe() {
  const { permissions, loading: permsLoading } = usePermissions();
  const { toast } = useToast();
  const [membres, setMembres] = useState<TeamMember[]>([]);
  const [max, setMax] = useState<number | undefined>();
  const [activite, setActivite] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ nom: '', email: '', role: 'collaborateur' as 'admin' | 'collaborateur' });
  const [inviting, setInviting] = useState(false);
  const [toRemove, setToRemove] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([getMembers(), getActivity()])
      .then(([m, a]) => {
        setMembres(m.data.membres);
        setMax(m.data.max);
        setActivite(a.data.items);
      })
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (permissions?.peutGererEquipe) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions?.peutGererEquipe]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await inviteMember(form);
      toast(res.data.emailEnvoye ? 'Invitation envoyée' : res.data.message);
      setInviteOpen(false);
      setForm({ nom: '', email: '', role: 'collaborateur' });
      load();
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setInviting(false); }
  };

  const handleRoleChange = async (id: string, role: 'admin' | 'collaborateur') => {
    try {
      await updateMemberRole(id, role);
      toast('Rôle mis à jour');
      load();
    } catch (err) { toast(apiError(err), 'error'); }
  };

  const handleRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await removeMember(toRemove.id);
      toast('Membre retiré');
      setToRemove(null);
      load();
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setRemoving(false); }
  };

  if (permsLoading || loading) return <div className="h-96 skeleton" />;

  if (!permissions?.peutGererEquipe) {
    return (
      <div>
        <PageHeader title="Équipe" subtitle="Invitez des collaborateurs sur votre compte" icon={<Users size={20} />} />
        <LockedFeature
          icon={<Users size={24} />}
          titre="Travaillez à plusieurs sur FactuFlow"
          description="Invitez des collaborateurs avec des rôles définis (administrateur ou collaborateur) pour gérer vos clients, devis et factures ensemble, avec un historique des actions de chacun."
          planRequis="Business"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Équipe"
        subtitle={`${membres.length}${max ? ` / ${max}` : ''} membre(s)`}
        icon={<Users size={20} />}
        actions={
          <button onClick={() => setInviteOpen(true)} className="btn-primary text-sm" disabled={!!max && membres.length >= max}>
            <UserPlus size={18} /> Inviter un membre
          </button>
        }
      />

      <div className="glass-card overflow-hidden mb-6 animate-fade-up">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100 bg-white/40">
                <th className="px-5 py-3 font-semibold">Membre</th>
                <th className="px-5 py-3 font-semibold">Rôle</th>
                <th className="px-5 py-3 font-semibold">Statut</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {membres.map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-[#0a0a0c]">{m.nom} {m.estActeur && <span className="text-xs text-gray-400">(vous)</span>}</p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    {m.role === 'proprietaire' ? (
                      <span className="badge badge-payee"><ShieldCheck size={12} className="inline mr-1" />Propriétaire</span>
                    ) : (
                      <select
                        className="field !py-1.5 !text-xs w-auto"
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as 'admin' | 'collaborateur')}
                      >
                        <option value="admin">Administrateur</option>
                        <option value="collaborateur">Collaborateur</option>
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`badge ${m.emailVerifie ? 'badge-payee' : 'badge-brouillon'}`}>
                      {m.emailVerifie ? 'Actif' : 'Invitation en attente'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {m.role !== 'proprietaire' && (
                      <button className="btn-icon" onClick={() => setToRemove(m)} title="Retirer"><Trash2 size={15} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-6 animate-fade-up">
        <h3 className="font-bold text-[#0a0a0c] mb-4 flex items-center gap-2"><History size={18} /> Historique récent</h3>
        {activite.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune activité enregistrée pour le moment.</p>
        ) : (
          <ul className="space-y-3">
            {activite.map((a) => (
              <li key={a._id} className="text-sm flex items-start justify-between gap-3 border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                <div>
                  <span className="font-semibold text-[#0a0a0c]">{a.acteurNom}</span>{' '}
                  <span className="text-gray-500">{a.details}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{new Date(a.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Inviter un membre" size="sm">
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="field-label">Nom complet</label>
            <input required className="field" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input required type="email" className="field" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Rôle</label>
            <select className="field" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'collaborateur' }))}>
              <option value="collaborateur">Collaborateur — utilise FactuFlow au quotidien</option>
              <option value="admin">Administrateur — peut aussi gérer l'équipe et l'abonnement</option>
            </select>
          </div>
          <button type="submit" disabled={inviting} className="btn-primary w-full justify-center">
            {inviting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Envoyer l'invitation
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toRemove}
        title="Retirer ce membre"
        message={`Retirer "${toRemove?.nom}" de votre équipe ? Il perdra immédiatement l'accès au compte.`}
        confirmLabel="Retirer"
        onConfirm={handleRemove}
        onClose={() => setToRemove(null)}
        loading={removing}
      />
    </div>
  );
}
