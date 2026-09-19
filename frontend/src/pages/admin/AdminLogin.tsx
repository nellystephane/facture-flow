import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import OryxaLogo from '../../components/OryxaLogo';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    setChargement(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err: any) {
      setErreur(err.response?.data?.message || 'Connexion impossible');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="dark">
      <div className="app-bg !min-h-screen flex items-center justify-center px-6">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="relative z-10 w-full max-w-sm">
          <div className="flex flex-col items-center gap-3 mb-8 text-center">
            <OryxaLogo size={56} nameClassName="font-extrabold text-xl text-white" imageClassName="rounded-2xl shadow-lg" />
            <div>
              <h1 className="text-xl font-extrabold text-white">Administration Oryxa</h1>
              <p className="text-sm text-gray-400 mt-1">Accès réservé — espace non lié à votre compte Oryxa habituel.</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="glass-card p-6 flex flex-col gap-4">
            {erreur && (
              <div className="text-sm text-[#f4847d] bg-[#f4847d]/10 border border-[#f4847d]/30 rounded-lg px-3 py-2.5">
                {erreur}
              </div>
            )}

            <div>
              <label className="field-label">Email admin</label>
              <input
                type="email"
                required
                autoFocus
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@votredomaine.com"
              />
            </div>

            <div>
              <label className="field-label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="field pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={chargement} className="btn-primary w-full justify-center mt-2">
              {chargement ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">
            Vous cherchez à gérer votre entreprise ?{' '}
            <a href={`${import.meta.env.BASE_URL}login`} className="text-gray-400 hover:text-gray-200 underline">
              Connexion utilisateur
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
