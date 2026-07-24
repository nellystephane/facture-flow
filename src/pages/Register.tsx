import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, User, Mail, Lock, Building2, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiError } from '../utils/format';

export default function Register() {
  const [form, setForm] = useState({ nom: '', entreprise: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      navigate('/app');
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
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
            style={{ background: 'linear-gradient(135deg,#e11d2a,#b3121d)' }}>
            <Zap size={24} fill="white" />
          </div>
          <span className="font-extrabold text-2xl text-[#0a0a0c]">FactuFlow</span>
        </Link>

        <div className="glass-card p-8">
          <h1 className="text-2xl font-extrabold text-[#0a0a0c] text-center">Créer votre compte</h1>
          <p className="text-sm text-gray-500 text-center mt-1 mb-6">Gratuit. Sans carte bancaire.</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium text-[#b3121d] bg-[rgba(225,29,42,0.1)] border border-[rgba(225,29,42,0.2)] animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">Nom complet</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Jean Kouassi" value={form.nom}
                  onChange={(e) => update('nom', e.target.value)} className="field pl-10" required autoFocus />
              </div>
            </div>

            <div>
              <label className="field-label">Entreprise <span className="text-gray-400 font-normal">(optionnel)</span></label>
              <div className="relative">
                <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Mon Entreprise SARL" value={form.entreprise}
                  onChange={(e) => update('entreprise', e.target.value)} className="field pl-10" />
              </div>
            </div>

            <div>
              <label className="field-label">Adresse email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" placeholder="vous@exemple.com" value={form.email}
                  onChange={(e) => update('email', e.target.value)} className="field pl-10" required />
              </div>
            </div>

            <div>
              <label className="field-label">Mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={showPass ? 'text' : 'password'} placeholder="Min. 6 caractères" value={form.password}
                  onChange={(e) => update('password', e.target.value)} className="field pl-10 pr-10" required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#e11d2a]">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Check size={14} className="text-green-600" /> Gratuit</span>
              <span className="flex items-center gap-1"><Check size={14} className="text-green-600" /> Sans carte</span>
              <span className="flex items-center gap-1"><Check size={14} className="text-green-600" /> Sans engagement</span>
            </div>

            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading && <span className="spinner" style={{ width: 16, height: 16 }} />}
              Créer mon compte <ArrowRight size={18} />
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Déjà inscrit ?{' '}
            <Link to="/login" className="font-semibold text-[#e11d2a] hover:underline">Se connecter</Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          <Link to="/" className="hover:text-[#e11d2a]">← Retour à l'accueil</Link>
        </p>
      </div>
    </div>
  );
}
