import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Mail, KeyRound, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as authApi from '../api/auth';
import { apiError } from '../utils/format';

function erreurMotDePasse(password: string): string | null {
  if (!password || password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un caractère spécial (ex: ! ? # @ % &).';
  return null;
}

export default function ForgotPassword() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setInfo(res.data.message);
      setStep('code');
    } catch (err) {
      setError(apiError(err, "Échec de l'envoi du code"));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const pe = erreurMotDePasse(password);
    if (pe) { setError(pe); return; }
    setLoading(true);
    try {
      const res = await authApi.resetPassword(email.trim(), code.trim(), password);
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      navigate('/app');
    } catch (err) {
      setError(apiError(err, 'Code invalide'));
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
            style={{ background: 'linear-gradient(135deg,#d9524d,#b23c37)' }}>
            <Zap size={24} fill="white" />
          </div>
          <span className="font-extrabold text-2xl text-[#0a0a0c]">FactuFlow</span>
        </Link>

        <div className="glass-card p-8">
          <h1 className="text-2xl font-extrabold text-[#0a0a0c] text-center">Mot de passe oublié</h1>
          <p className="text-sm text-gray-500 text-center mt-1 mb-6">
            {step === 'email'
              ? 'Indiquez votre adresse email pour recevoir un code de réinitialisation.'
              : <>Entrez le code envoyé à <strong>{email}</strong> et votre nouveau mot de passe.</>}
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium text-[#b23c37] bg-[rgba(225,29,42,0.1)] border border-[rgba(225,29,42,0.2)] animate-fade-in">
              {error}
            </div>
          )}
          {info && step === 'code' && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium text-green-700 bg-green-50 border border-green-200 animate-fade-in">
              {info}
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label className="field-label">Adresse email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" placeholder="vous@exemple.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} className="field pl-10" required autoFocus />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                {loading && <span className="spinner" style={{ width: 16, height: 16 }} />}
                Recevoir un code <ArrowRight size={18} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="field-label">Code reçu par email</label>
                <div className="relative">
                  <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="field pl-10 text-center tracking-[0.4em] font-bold" required autoFocus />
                </div>
              </div>
              <div>
                <label className="field-label">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPass ? 'text' : 'password'} placeholder="Min. 8 caractères + 1 spécial" value={password}
                    onChange={(e) => setPassword(e.target.value)} className="field pl-10 pr-10" required />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#d9524d]">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                {loading && <span className="spinner" style={{ width: 16, height: 16 }} />}
                Réinitialiser mon mot de passe <ArrowRight size={18} />
              </button>
              <button type="button" onClick={() => setStep('email')} className="text-xs text-gray-400 hover:text-[#d9524d] w-full text-center">
                ← Utiliser une autre adresse email
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          <Link to="/login" className="hover:text-[#d9524d]">← Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
