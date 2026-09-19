import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { User, Save, Building2, Mail, Phone, MapPin, CreditCard, Zap, Check, ImageIcon, Loader2, Upload, Trash2, Lock, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile, getProfile, uploadLogo, removeLogo, changePassword } from '../api/auth';
import { updatePayoutSettings, resendPayoutConfirmation, type PayoutSettings } from '../api/payouts';
import PageHeader from '../components/ui/PageHeader';
import Select from '../components/ui/Select';
import LogoEditorModal from '../components/LogoEditorModal';
import { useToast } from '../contexts/ToastContext';
import { apiError } from '../utils/format';

// Devises courantes pour notre marché (Afrique francophone) + quelques
// devises internationales fréquentes pour les clients qui facturent à
// l'étranger. Une liste fermée évite les fautes de frappe ("FCA", "Fcfa"...)
// qui cassaient l'affichage des montants sur les PDF.
const DEVISES = [
  { value: 'FCFA', label: 'FCFA', sublabel: 'Franc CFA (UEMOA/CEMAC)' },
  { value: 'EUR', label: 'EUR', sublabel: 'Euro' },
  { value: 'USD', label: 'USD', sublabel: 'Dollar américain' },
  { value: 'GBP', label: 'GBP', sublabel: 'Livre sterling' },
  { value: 'NGN', label: 'NGN', sublabel: 'Naira nigérian' },
  { value: 'GHS', label: 'GHS', sublabel: 'Cedi ghanéen' },
  { value: 'MAD', label: 'MAD', sublabel: 'Dirham marocain' },
  { value: 'XOF', label: 'XOF', sublabel: 'Franc CFA (UEMOA) — code ISO' },
  { value: 'XAF', label: 'XAF', sublabel: 'Franc CFA (CEMAC) — code ISO' },
];

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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pwdForm, setPwdForm] = useState({ actuel: '', nouveau: '', confirmation: '' });
  const [changingPwd, setChangingPwd] = useState(false);
  const [payout, setPayout] = useState<PayoutSettings>({ enabled: user?.payoutSettings?.enabled ?? false, mode: 'mobile_money', provider: user?.payoutSettings?.provider ?? 'mtn', phone: user?.payoutSettings?.phone ?? '', country: user?.payoutSettings?.country ?? 'BJ', titulaire: user?.payoutSettings?.titulaire ?? user?.nom ?? '', schedule: user?.payoutSettings?.schedule ?? 'weekly' });
  const [savingPayout, setSavingPayout] = useState(false);
  const [resendingPayoutConfirmation, setResendingPayoutConfirmation] = useState(false);

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

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      toast('Format non supporté : utilisez un PNG, JPG ou SVG.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('Image trop lourde. Maximum : 2 Mo avant optimisation.', 'error');
      return;
    }
    setLogoFile(file);
  };

  const saveEditedLogo = async (base64: string) => {
    setUploadingLogo(true);
    try {
      const res = await uploadLogo(base64);
      setUser(res.data);
      setLogoFile(null);
      toast('Identité visuelle enregistrée');
    } catch (err) {
      toast(apiError(err), 'error');
      throw err;
    } finally {
      setUploadingLogo(false);
    }
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.nouveau !== pwdForm.confirmation) {
      toast('La confirmation ne correspond pas au nouveau mot de passe.', 'error');
      return;
    }
    setChangingPwd(true);
    try {
      await changePassword(pwdForm.actuel, pwdForm.nouveau);
      toast('Mot de passe mis à jour');
      setPwdForm({ actuel: '', nouveau: '', confirmation: '' });
    } catch (err) { toast(apiError(err), 'error'); }
    finally { setChangingPwd(false); }
  };

  return (
    <div>
      <PageHeader title="Mon profil" subtitle="Gérez vos informations et votre abonnement" icon={<User size={20} />} />

      {confirmationEnCours && (
        <div className="glass-card p-4 mb-6 flex items-center gap-3 animate-fade-in">
          <Loader2 size={18} className="animate-spin text-[#d9524d]" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Confirmation de votre paiement en cours... Cela prend généralement quelques secondes.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Formulaire */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="glass-card p-6 animate-fade-up">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-5">Informations personnelles</h3>

            <div className="flex items-center gap-4 mb-6">
              {user?.logoUrl ? (
                <img
                  src={user.logoUrl}
                  alt="Logo de l'entreprise"
                  className="w-20 h-20 rounded-2xl object-contain bg-white dark:bg-[#151518] shadow-lg shrink-0 border border-gray-100 dark:border-white/10"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-extrabold text-3xl shadow-lg shrink-0"
                  style={{ background: 'linear-gradient(135deg,#d9524d,#b23c37)' }}>
                  {user?.nom?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div>
                <p className="text-lg font-bold text-[#0a0a0c] dark:text-white">{user?.nom}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
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
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 z-10" />
                  <input className="field pl-9" value={form.nom} onChange={(e) => update('nom', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="field-label">Entreprise</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 z-10" />
                  <input className="field pl-9" value={form.entreprise} onChange={(e) => update('entreprise', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="field-label">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 z-10" />
                  <input type="email" className="field pl-9" value={form.email} onChange={(e) => update('email', e.target.value)} disabled />
                </div>
              </div>
              <div>
                <label className="field-label">Téléphone</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 z-10" />
                  <input className="field pl-9" value={form.telephone} onChange={(e) => update('telephone', e.target.value)} />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="field-label">Adresse</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 z-10" />
                  <input className="field pl-9" value={form.adresse} onChange={(e) => update('adresse', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="field-label">Devise</label>
                <Select
                  value={form.devise}
                  onChange={(v) => update('devise', v)}
                  options={DEVISES}
                  placeholder="Choisir une devise"
                />
              </div>
            </div>

            {/* Logo */}
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-white/10">
              <label className="field-label flex items-center gap-1.5">
                <ImageIcon size={14} /> Logo de l'entreprise
                {!estPremium && <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">— affiché sur vos PDF avec un plan Pro ou Business</span>}
              </label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                PNG, JPG ou SVG. Ajustez le cadrage et la position avant de l’enregistrer. Apparaît sur vos factures, devis et reçus PDF.
              </p>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoFile} />
              <div className="flex items-center gap-3">
                <button type="button" onClick={handleLogoPick} disabled={uploadingLogo || !estPremium} className="btn-ghost text-sm">
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
                  L’éditeur d’identité visuelle est réservé aux plans Pro et Business. Passez à Pro pour importer et ajuster votre logo.
                </p>
              )}
            </div>

            <div className="flex justify-end mt-6 pt-6 border-t border-gray-100 dark:border-white/10">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving && <span className="spinner" style={{ width: 16, height: 16 }} />}
                <Save size={18} /> Enregistrer
              </button>
            </div>
          </form>

          {/* Reversements */}
          <div className="glass-card p-6 animate-fade-up">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-1 flex items-center gap-2"><CreditCard size={16} /> Reversements</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">Configurez le compte vers lequel votre solde retirable sera envoyé. Les reversements automatiques utilisent l'API FedaPay réelle.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="field-label">Mode de retrait</label><select className="field" value="mobile_money" disabled><option value="mobile_money">Mobile Money</option></select></div>
              <div><label className="field-label">Opérateur</label><select className="field" value={payout.provider} onChange={(e) => setPayout({ ...payout, provider: e.target.value })}><option value="mtn">MTN</option><option value="moov">Moov</option><option value="celtiis">Celtiis</option></select></div>
              <div><label className="field-label">Numéro Mobile Money</label><input className="field" value={payout.phone} onChange={(e) => setPayout({ ...payout, phone: e.target.value })} placeholder="+229…" /><p className="text-[11px] text-gray-400 mt-1">Assurez-vous que ce numéro peut recevoir des paiements Mobile Money.</p></div>
              <div><label className="field-label">Titulaire</label><input className="field" value={payout.titulaire} onChange={(e) => setPayout({ ...payout, titulaire: e.target.value })} /></div>
              <div><label className="field-label">Fréquence</label><select className="field" value={payout.schedule} onChange={(e) => setPayout({ ...payout, schedule: e.target.value as any })}><option value="weekly">Chaque semaine</option><option value="monthly">Chaque mois</option></select></div>
            </div>
            <div className="mt-4 rounded-xl border border-gray-100 dark:border-white/10 p-3 text-sm">
              {user?.payoutSettings?.status === 'active' && user?.payoutSettings?.emailConfirmed ? <p className="text-green-700 dark:text-green-400 flex items-center gap-2"><Check size={16} /> Moyen de retrait confirmé par email.</p> : <p className="text-amber-700 dark:text-amber-400">Après l’enregistrement, Oryxa vous enverra un email. Le moyen restera en attente jusqu’à sa confirmation.</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-2 mt-5">
              {user?.payoutSettings?.status === 'pending' && <button type="button" className="btn-ghost text-sm" disabled={resendingPayoutConfirmation} onClick={async () => { setResendingPayoutConfirmation(true); try { await resendPayoutConfirmation(); toast('Email de confirmation renvoyé'); } catch (err) { toast(apiError(err), 'error'); } finally { setResendingPayoutConfirmation(false); } }}>{resendingPayoutConfirmation ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Mail size={16} />} Renvoyer l’email</button>}
              <button type="button" className="btn-primary" disabled={savingPayout} onClick={async () => { setSavingPayout(true); try { const res = await updatePayoutSettings({ ...payout, enabled: true }); if (res.data?.payoutSettings) setUser({ ...(user as any), payoutSettings: res.data.payoutSettings }); toast(res.data?.confirmationRequired ? 'Moyen enregistré. Vérifiez votre email pour le confirmer.' : 'Paramètres de reversement enregistrés'); } catch (err) { toast(apiError(err), 'error'); } finally { setSavingPayout(false); } }}>{savingPayout ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Save size={16} />} Enregistrer le moyen</button>
            </div>
            <p className="text-[11px] text-gray-500 mt-3">Les cartes bancaires sont proposées au client sur le Checkout FedaPay pour les paiements entrants. Elles ne sont pas utilisées comme destination de reversement : FedaPay indique actuellement que les retraits par carte bancaire ne sont pas disponibles.</p>
          </div>

          {/* Sécurité — changer le mot de passe */}
          <form onSubmit={handleChangePassword} className="glass-card p-6 animate-fade-up delay-1">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-1 flex items-center gap-2"><Lock size={16} /> Sécurité</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">Changez votre mot de passe. Vous resterez connecté sur cet appareil.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="field-label">Mot de passe actuel</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 z-10" />
                  <input type="password" required className="field pl-9" value={pwdForm.actuel}
                    onChange={(e) => setPwdForm((f) => ({ ...f, actuel: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="field-label">Nouveau mot de passe</label>
                <input type="password" required minLength={8} className="field" value={pwdForm.nouveau}
                  onChange={(e) => setPwdForm((f) => ({ ...f, nouveau: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Confirmer le nouveau mot de passe</label>
                <input type="password" required minLength={8} className="field" value={pwdForm.confirmation}
                  onChange={(e) => setPwdForm((f) => ({ ...f, confirmation: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Au moins 8 caractères, avec un caractère spécial (ex: ! ? # @ % &).</p>
            <div className="flex justify-end mt-5">
              <button type="submit" className="btn-primary" disabled={changingPwd}>
                {changingPwd && <span className="spinner" style={{ width: 16, height: 16 }} />}
                <Lock size={16} /> Mettre à jour le mot de passe
              </button>
            </div>
          </form>
        </div>

        {/* Abonnement */}
        <div className="space-y-6">
          <div className="glass-card p-6 animate-fade-up delay-1">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={18} className="text-[#d9524d]" />
              <h3 className="font-bold text-[#0a0a0c] dark:text-white">Votre abonnement</h3>
            </div>
            <div className="rounded-2xl p-5 text-white mb-4" style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}>
              <p className="text-xs text-gray-300 dark:text-gray-600 uppercase">Plan actuel</p>
              <p className="text-2xl font-extrabold capitalize">{estPremium ? (user?.subscription || 'gratuit') : 'gratuit'}</p>
              {!estPremium && user?.subscription && user.subscription !== 'gratuit' && (
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                  Votre abonnement {user.subscription} a expiré
                  {user.abonnement?.dateFin ? ` le ${new Date(user.abonnement.dateFin).toLocaleDateString('fr-FR')}` : ''}.
                </p>
              )}
            </div>
            <ul className="space-y-2 text-sm">
              {[
                { label: 'Factures illimitées (plan Gratuit : 5/mois)', included: estPremium },
                { label: 'Facturation express depuis un tarif préconçu', included: estPremium },
                { label: 'Logo personnalisé sur vos PDF', included: estPremium },
                { label: 'Devis, clients, paiement en ligne, reçus', included: true },
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Check size={16} className={f.included ? 'text-green-600' : 'text-gray-300 dark:text-gray-600'} />
                  {f.label}
                  {!f.included && <span className="text-xs text-gray-400 dark:text-gray-500">(Plan supérieur)</span>}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              Le plan Gratuit inclut 5 factures et 5 devis par mois, jusqu’à 20 clients. PDF,
              envoi par email, paiement en ligne (Mobile Money/carte/virement) et reçus automatiques restent disponibles.
            </p>
          </div>

          {!estPremium && (
            <div className="glass-card p-6 animate-fade-up delay-2"
              style={{ background: 'linear-gradient(135deg, rgba(225,29,42,0.08), rgba(10,10,12,0.04))' }}>
              <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-2">Passez au niveau supérieur</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Débloquez les factures illimitées, la facturation express et le logo personnalisé.
              </p>
              <Link to="/app/abonnement" className="btn-primary w-full justify-center">
                <Zap size={16} /> Améliorer mon plan
              </Link>
            </div>
          )}
        </div>
      </div>

      <LogoEditorModal open={!!logoFile} onClose={() => { if (!uploadingLogo) setLogoFile(null); }} file={logoFile} saving={uploadingLogo} onSave={saveEditedLogo} />
    </div>
  );
}
