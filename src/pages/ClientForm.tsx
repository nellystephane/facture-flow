import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, ArrowLeft, Save } from 'lucide-react';
import { getClient, createClient, updateClient } from '../api/clients';
import PageHeader from '../components/ui/PageHeader';
import { useToast } from '../contexts/ToastContext';
import { apiError } from '../utils/format';

const EMPTY = { nom: '', entreprise: '', email: '', telephone: '', adresse: '', notes: '' };

export default function ClientForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    getClient(id!)
      .then((res) => setForm({
        nom: res.data.nom || '',
        entreprise: res.data.entreprise || '',
        email: res.data.email || '',
        telephone: res.data.telephone || '',
        adresse: res.data.adresse || '',
        notes: res.data.notes || '',
      }))
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await updateClient(id!, form);
        toast('Client mis à jour');
      } else {
        await createClient(form);
        toast('Client créé avec succès');
      }
      navigate('/app/clients');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-96 skeleton" />;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Modifier le client' : 'Nouveau client'}
        subtitle={isEdit ? form.nom : 'Ajoutez un client à votre carnet'}
        icon={<Users size={20} />}
        actions={
          <button onClick={() => navigate(-1)} className="btn-ghost text-sm">
            <ArrowLeft size={16} /> Retour
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="glass-card p-6 md:p-8 max-w-2xl animate-fade-up">
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="field-label">Nom complet *</label>
            <input className="field" value={form.nom} onChange={(e) => update('nom', e.target.value)} required autoFocus />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Entreprise</label>
            <input className="field" value={form.entreprise} onChange={(e) => update('entreprise', e.target.value)} placeholder="Optionnel" />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input type="email" className="field" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
          <div>
            <label className="field-label">Téléphone</label>
            <input className="field" value={form.telephone} onChange={(e) => update('telephone', e.target.value)} placeholder="+225 ..." />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Adresse</label>
            <input className="field" value={form.adresse} onChange={(e) => update('adresse', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Notes</label>
            <textarea className="field" rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Informations complémentaires..." />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-gray-100">
          <button type="button" onClick={() => navigate('/app/clients')} className="btn-ghost">Annuler</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving && <span className="spinner" style={{ width: 16, height: 16 }} />}
            <Save size={18} /> {isEdit ? 'Mettre à jour' : 'Créer le client'}
          </button>
        </div>
      </form>
    </div>
  );
}
