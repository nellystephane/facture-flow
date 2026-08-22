import { useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Zap, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as authApi from '../api/auth';
import { apiError } from '../utils/format';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email) { setError('Adresse email manquante — recommencez l\'inscription.'); return; }
    setLoading(true);
    try {
      const res = await authApi.verifyEmail(email, code.trim());
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      navigate('/app');
    } catch (err) {
      setError(apiError(err, 'Code invalide'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setError('');
    setInfo('');
    try {
      const res = await authApi.resendVerificationCode(email);
      setInfo(res.data.message || 'Un nouveau code vous a été envoyé.');
      inputRef.current?.focus();
    } catch (err) {
      setError(apiError(err, "Échec de l'envoi du code"));
    } finally {
      setResending(false);
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
          <div className="w-12 h-12 rounded-xl bg-[rgba(225,29,42,0.1)] flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={22} className="text-[#d9524d]" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#0a0a0c] text-center">Confirmez votre email</h1>
          <p className="text-sm text-gray-500 text-center mt-1 mb-6">
            Entrez le code à 6 chiffres envoyé à<br /><strong>{email || 'votre adresse email'}</strong>
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium text-[#b23c37] bg-[rgba(225,29,42,0.1)] border border-[rgba(225,29,42,0.2)] animate-fade-in">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium text-green-700 bg-green-50 border border-green-200 animate-fade-in">
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">Code de confirmation</label>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="field text-center text-2xl tracking-[0.5em] font-bold"
                required
                autoFocus
              />
            </div>

            <button type="submit" className="btn-primary w-full justify-center" disabled={loading || code.length !== 6}>
              {loading && <span className="spinner" style={{ width: 16, height: 16 }} />}
              Confirmer <ArrowRight size={18} />
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Aucun code reçu ?{' '}
            <button onClick={handleResend} disabled={resending} className="font-semibold text-[#d9524d] hover:underline disabled:opacity-50">
              {resending ? 'Envoi...' : 'Renvoyer le code'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          <Link to="/login" className="hover:text-[#d9524d]">← Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
