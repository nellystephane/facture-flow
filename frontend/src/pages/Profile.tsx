import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { User, Save, Building2, Mail, Phone, MapPin, CreditCard, Zap, Check, ImageIcon, Loader2, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile, getProfile, uploadLogo, removeLogo } from '../api/auth';
import PageHeader from '../components/ui/PageHeader';
import { useToast } from '../contexts/ToastContext';
import { apiError } from '../utils/format';

const MAX_LOGO_MB = 0.9; // doit rester aligné avec MAX_LOGO_BYTES côté backend (900 Ko)

export default function Profile() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const estPremium = !!user?.estPremium;
  const [form, setForm] = useState({
    nom: user?.nom || '',
    entreprise: user?.entreprise || '',
    email: user?.email || '',
    telephone: user?.telephone || '',
    adresse: user?.adresse || '',
    devise: user?.devise || 'FCFA',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Après un paiement d'abonnement FedaPay réussi, l'utilisateur revient ici
  // via /app/profile?abonnement=retour AVANT que le webhook (asynchrone,
  // côté serveur) n'ait forcément fini de mettre à jour son compte. On
  // reinterroge le profil quelques secondes pour éviter de lui afficher
  // "Gratuit" juste après avoir payé.
  const [confirmationEnCours, setConfirmationEnCours] = useState(params.get('abonnement') === 'retour');
  const dejaConfirme = useRef(false);

  useEffect(() => {
    if (params.get('abonnement') !== 'retour' || dejaConfirme.current) return;
    let tentatives = 0;
    const interval = setInterval(async () => {
      tentatives += 1;
      try {
        const res = await getProfile();
        if (res.data.estPremium) {
          setUser(res.data);
          dejaConfirme.current = true;
          setConfirmationEnCours(false);
          toast('Abonnement confirmé, merci ! 🎉');
          clearInterval(interval);
        } else if (tentatives >= 10) {
          setConfirmationEnCours(false);
          clearInterval(interval);
        }
      } catch {
        // on retentera au prochain tick
      }
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleLogoPick = () => fileInputRef.current?.click();

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de resélectionner le même fichier ensuite
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast('Format non supporté : utilisez un PNG ou un JPG.', 'error');
      return;
    }
    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      toast(`Image trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum : ${MAX_LOGO_MB * 1000} Ko.`, 'error');
      return;
    }

    setUploadingLogo(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
        reader.readAsDataURL(file);
      });
      const res = await uploadLogo(base64);
      setUser(res.data);
      toast('Logo mis à jour');
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setUploadingLogo(false); }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    try {
      const res = await removeLogo();
      setUser(res.data);
      toast('Logo retiré');
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setUploadingLogo(false); }
  };

  return (
    <div>
      <PageHeader title="Mon profil" subtitle="Gérez vos informations et votre abonnement" icon={<User size={20} />} />

      {confirmationEnCours && (
        <div className="glass-card p-4 mb-6 flex items-center gap-3 animate-fade-in">
          <Loader2 size={18} className="animate-spin text-[#d9524d]" />
          <p className="text-sm text-gray-600">
            Confirmation de votre paiement en cours... Cela prend généralement quelques secondes.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="glass-card p-6 lg:col-span-2 animate-fade-up">
          <h3 className="font-bold text-[#0a0a0c] mb-5">Informations personnelles</h3>

          <div className="flex items-center gap-4 mb-6">
            {user?.logoUrl ? (
              <img
                src={user.logoUrl}
                alt="Logo de l'entreprise"
                className="w-20 h-20 rounded-2xl object-contain bg-white shadow-lg shrink-0 border border-gray-100"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-extrabold text-3xl shadow-lg shrink-0"
                style={{ background: 'linear-gradient(135deg,#d9524d,#b23c37)' }}>
                {user?.nom?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <p className="text-lg font-bold text-[#0a0a0c]">{user?.nom}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <span className="badge badge-brouillon mt-1">
                Plan {estPremium ? user?.subscription : 'gratuit'}
                {!estPremium && user?.subscription && user.subscription !== 'gratuit' ? ' (expiré)' : ''}
              </span>
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
                <input type="email" className="field pl-9" value={form.email} onChange={(e) => update('email', e.target.value)} disabled />
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

          {/* Logo */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <label className="field-label flex items-center gap-1.5">
              <ImageIcon size={14} /> Logo de l'entreprise
              {!estPremium && <span className="text-xs text-gray-400 font-normal">— affiché sur vos PDF avec un plan Pro ou Business</span>}
            </label>
            <p className="text-xs text-gray-400 mb-3">
              PNG ou JPG, {MAX_LOGO_MB * 1000} Ko maximum. Apparaît en en-tête de vos factures, devis et reçus PDF.
            </p>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoFile} />
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleLogoPick} disabled={uploadingLogo} className="btn-ghost text-sm">
                {uploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {user?.logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
              </button>
              {user?.logoUrl && (
                <button type="button" onClick={handleRemoveLogo} disabled={uploadingLogo} className="btn-icon" title="Retirer le logo">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {!estPremium && (
              <p className="text-xs text-amber-600 mt-2">
                Vous pouvez l'ajouter dès maintenant : il apparaîtra sur vos documents dès que vous passerez au plan Pro.
              </p>
            )}
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
              <Zap size={18} className="text-[#d9524d]" />
              <h3 className="font-bold text-[#0a0a0c]">Votre abonnement</h3>
            </div>
            <div className="rounded-2xl p-5 text-white mb-4" style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}>
              <p className="text-xs text-gray-300 uppercase">Plan actuel</p>
              <p className="text-2xl font-extrabold capitalize">{estPremium ? (user?.subscription || 'gratuit') : 'gratuit'}</p>
              {!estPremium && user?.subscription && user.subscription !== 'gratuit' && (
                <p className="text-xs text-gray-300 mt-1">
                  Votre abonnement {user.subscription} a expiré
                  {user.abonnement?.dateFin ? ` le ${new Date(user.abonnement.dateFin).toLocaleDateString('fr-FR')}` : ''}.
                </p>
              )}
            </div>
            <ul className="space-y-2 text-sm">
              {[
                { label: 'Factures illimitées (plan Gratuit : 10/mois)', included: estPremium },
                { label: 'Facturation express depuis un tarif préconçu', included: estPremium },
                { label: 'Logo personnalisé sur vos PDF', included: estPremium },
                { label: 'Devis, clients, paiement en ligne, reçus', included: true },
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-700">
                  <Check size={16} className={f.included ? 'text-green-600' : 'text-gray-300'} />
                  {f.label}
                  {!f.included && <span className="text-xs text-gray-400">(Plan supérieur)</span>}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-3">
              Disponibles sur tous les plans, y compris Gratuit : devis et clients illimités, PDF,
              envoi par email, paiement en ligne (Mobile Money/carte/virement) et reçus automatiques.
            </p>
          </div>

          {!estPremium && (
            <div className="glass-card p-6 animate-fade-up delay-2"
              style={{ background: 'linear-gradient(135deg, rgba(225,29,42,0.08), rgba(10,10,12,0.04))' }}>
              <h3 className="font-bold text-[#0a0a0c] mb-2">Passez au niveau supérieur</h3>
              <p className="text-sm text-gray-600 mb-4">
                Débloquez les factures illimitées, la facturation express et le logo personnalisé.
              </p>
              <Link to="/app/abonnement" className="btn-primary w-full justify-center">
                <Zap size={16} /> Améliorer mon plan
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
