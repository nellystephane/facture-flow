import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Building2, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiError } from '../utils/format';
import OryxaLogo from '../components/OryxaLogo';

function erreurMotDePasse(password: string): string | null {
  if (!password || password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un caractère spécial (ex: ! ? # @ % &).';
  return null;
}

export default function Register() {
  const [params] = useSearchParams();
  const referralCode = params.get('ref') || localStorage.getItem('oryxa_affiliate_ref') || '';
  const affiliateMode = params.get('affiliate') === '1' || !!referralCode;
  const [form, setForm] = useState({ nom: '', entreprise: '', email: '', telephone: '', whatsapp: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const pwdError = form.password ? erreurMotDePasse(form.password) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const pe = erreurMotDePasse(form.password);
    if (pe) { setError(pe); return; }
    if (!acceptedTerms) { setError('Merci d’accepter les CGU et la politique de confidentialité pour continuer.'); return; }
    setLoading(true);
    try {
      const user = await register({ ...form, referralCode: referralCode || undefined });
      if (user) {
        navigate('/app'); // compte déjà vérifié (cas legacy) — connexion directe
      } else {
        navigate(`/verifier-email?email=${encodeURIComponent(form.email)}`);
      }
    } catch (err) {
      setError(apiError(err, "Erreur lors de l'inscription"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-bg min-h-screen flex items-center justify-center p-4 py-8">
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <Link to="/" className="flex justify-center mb-6" aria-label="Oryxa — accueil">
          <OryxaLogo size={52} nameClassName="font-extrabold text-2xl text-[#0a0a0c] dark:text-white" imageClassName="rounded-xl shadow-lg" />
        </Link>

        <div className="glass-card p-8">
          <h1 className="text-2xl font-extrabold text-[#0a0a0c] dark:text-white text-center">Créer votre compte</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1 mb-6">Gratuit. Sans carte bancaire.</p>
          {affiliateMode && <div className="mb-5 rounded-2xl bg-[#d9524d]/10 border border-[#d9524d]/20 px-4 py-3 text-sm text-[#b23c37]">Vous êtes inscrit via un lien partenaire Oryxa. Après vérification de votre email, votre avantage affilié sera pris en compte automatiquement sur les abonnements éligibles.</div>}

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium text-[#b23c37] bg-[rgba(225,29,42,0.1)] border border-[rgba(225,29,42,0.2)] animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">Nom complet</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input type="text" placeholder="Jean Kouassi" value={form.nom}
                  onChange={(e) => update('nom', e.target.value)} className="field pl-10" required autoFocus />
              </div>
            </div>

            <div>
              <label className="field-label">Entreprise <span className="text-gray-400 dark:text-gray-500 font-normal">(optionnel)</span></label>
              <div className="relative">
                <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input type="text" placeholder="Mon Entreprise SARL" value={form.entreprise}
                  onChange={(e) => update('entreprise', e.target.value)} className="field pl-10" />
              </div>
            </div>

            <div>
              <label className="field-label">Adresse email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input type="email" placeholder="vous@exemple.com" value={form.email}
                  onChange={(e) => update('email', e.target.value)} className="field pl-10" required />
              </div>
            </div>

            <div>
              <label className="field-label">WhatsApp <span className="text-gray-400 font-normal">(recommandé)</span></label>
              <input type="tel" placeholder="+229 …" value={form.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} className="field" />
              <p className="text-[11px] text-gray-400 mt-1">Pour faciliter le partage de vos factures et devis.</p>
            </div>

            <div>
              <label className="field-label">Mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input type={showPass ? 'text' : 'password'} placeholder="Min. 8 caractères + 1 spécial" value={form.password}
                  onChange={(e) => update('password', e.target.value)} className="field pl-10 pr-10" required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-[#d9524d]">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className={`text-xs mt-1 ${pwdError ? 'text-gray-400 dark:text-gray-500' : form.password ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}`}>
                8 caractères minimum, avec au moins un caractère spécial (! ? # @ % &...)
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1"><Check size={14} className="text-green-600" /> Gratuit</span>
              <span className="flex items-center gap-1"><Check size={14} className="text-green-600" /> Sans carte</span>
              <span className="flex items-center gap-1"><Check size={14} className="text-green-600" /> Sans engagement</span>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 accent-[#d9524d]"
              />
              <span>
                J'accepte les{' '}
                <Link to="/cgu" target="_blank" className="text-[#d9524d] font-medium hover:underline">Conditions Générales d'Utilisation</Link>
                {' '}et la{' '}
                <Link to="/confidentialite" target="_blank" className="text-[#d9524d] font-medium hover:underline">Politique de confidentialité</Link>.
              </span>
            </label>

            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading && <span className="spinner" style={{ width: 16, height: 16 }} />}
              Créer mon compte <ArrowRight size={18} />
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Déjà inscrit ?{' '}
            <Link to="/login" className="font-semibold text-[#d9524d] hover:underline">Se connecter</Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-5">
          <Link to="/" className="hover:text-[#d9524d]">← Retour à l'accueil</Link>
        </p>
      </div>
    </div>
  );
}
