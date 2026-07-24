import { useState } from 'react';
import { User, Save, Building2, Mail, Phone, MapPin, CreditCard, Zap, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile } from '../api/auth';
import PageHeader from '../components/ui/PageHeader';
import { useToast } from '../contexts/ToastContext';
import { apiError } from '../utils/format';

export default function Profile() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    nom: user?.nom || '',
    entreprise: user?.entreprise || '',
    email: user?.email || '',
    telephone: user?.telephone || '',
    adresse: user?.adresse || '',
    devise: user?.devise || 'FCFA',
  });
  const [saving, setSaving] = useState(false);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateProfile(form);
      setUser(res.data);
      toast('Profil mis à jour');
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Mon profil" subtitle="Gérez vos informations et votre abonnement" icon={<User size={20} />} />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="glass-card p-6 lg:col-span-2 animate-fade-up">
          <h3 className="font-bold text-[#0a0a0c] mb-5">Informations personnelles</h3>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-extrabold text-3xl shadow-lg shrink-0"
              style={{ background: 'linear-gradient(135deg,#e11d2a,#b3121d)' }}>
              {user?.nom?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-lg font-bold text-[#0a0a0c]">{user?.nom}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <span className="badge badge-brouillon mt-1">Plan {user?.subscription || 'gratuit'}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Nom complet</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="field pl-9" value={form.nom} onChange={(e) => update('nom', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label">Entreprise</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="field pl-9" value={form.entreprise} onChange={(e) => update('entreprise', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" className="field pl-9" value={form.email} onChange={(e) => update('email', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label">Téléphone</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="field pl-9" value={form.telephone} onChange={(e) => update('telephone', e.target.value)} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Adresse</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="field pl-9" value={form.adresse} onChange={(e) => update('adresse', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label">Devise</label>
              <div className="relative">
                <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="field pl-9" value={form.devise} onChange={(e) => update('devise', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-6 border-t border-gray-100">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <span className="spinner" style={{ width: 16, height: 16 }} />}
              <Save size={18} /> Enregistrer
            </button>
          </div>
        </form>

        {/* Abonnement */}
        <div className="space-y-6">
          <div className="glass-card p-6 animate-fade-up delay-1">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={18} className="text-[#e11d2a]" />
              <h3 className="font-bold text-[#0a0a0c]">Votre abonnement</h3>
            </div>
            <div className="rounded-2xl p-5 text-white mb-4" style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}>
              <p className="text-xs text-gray-300 uppercase">Plan actuel</p>
              <p className="text-2xl font-extrabold capitalize">{user?.subscription || 'gratuit'}</p>
            </div>
            <ul className="space-y-2 text-sm">
              {[
                { label: 'Factures illimitées', included: user?.subscription !== 'gratuit' },
                { label: 'Relances automatiques', included: user?.subscription !== 'gratuit' },
                { label: 'Personnalisation logo', included: user?.subscription !== 'gratuit' },
                { label: "Gestion d'équipe", included: user?.subscription === 'business' },
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-700">
                  <Check size={16} className={f.included ? 'text-green-600' : 'text-gray-300'} />
                  {f.label}
                  {!f.included && <span className="text-xs text-gray-400">(Plan supérieur)</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card p-6 animate-fade-up delay-2"
            style={{ background: 'linear-gradient(135deg, rgba(225,29,42,0.08), rgba(10,10,12,0.04))' }}>
            <h3 className="font-bold text-[#0a0a0c] mb-2">Passez au niveau supérieur</h3>
            <p className="text-sm text-gray-600 mb-4">
              Débloquez les factures illimitées, les relances auto et bien plus.
            </p>
            <button className="btn-primary w-full justify-center" onClick={() => toast('Paiement en ligne bientôt disponible 🚀')}>
              <Zap size={16} /> Améliorer mon plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
