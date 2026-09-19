import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as authApi from '../api/auth';
import { apiError } from '../utils/format';
import OryxaLogo from '../components/OryxaLogo';

const DUREE_CODE_S = 3 * 60; // doit rester aligné avec DUREE_CODE_VERIFICATION_MS côté backend

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondesRestantes, setSecondesRestantes] = useState(DUREE_CODE_S);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join('');
  const expire = secondesRestantes <= 0;

  // Décompte visuel — purement indicatif (le serveur est la seule source de
  // vérité sur l'expiration réelle), mais évite qu'un utilisateur saisisse
  // un code qu'il sait déjà périmé.
  const demarrerDecompte = useCallback(() => {
    setSecondesRestantes(DUREE_CODE_S);
  }, []);

  useEffect(() => {
    demarrerDecompte();
  }, [demarrerDecompte]);

  useEffect(() => {
    if (secondesRestantes <= 0) return;
    const t = setInterval(() => setSecondesRestantes((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondesRestantes <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const minutes = Math.floor(secondesRestantes / 60);
  const secondes = secondesRestantes % 60;

  const setDigit = (index: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(-1);
    setDigits((d) => {
      const next = [...d];
      next[index] = v;
      return next;
    });
    if (v && index < 5) boxRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      boxRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(6).fill('');
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setDigits(next);
    boxRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email) { setError("Adresse email manquante — recommencez l'inscription."); return; }
    setLoading(true);
    try {
      const res = await authApi.verifyEmail(email, code);
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      navigate('/app');
    } catch (err) {
      setError(apiError(err, 'Code invalide'));
      setDigits(Array(6).fill(''));
      boxRefs.current[0]?.focus();
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
      setDigits(Array(6).fill(''));
      demarrerDecompte();
      boxRefs.current[0]?.focus();
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
        <Link to="/" className="flex justify-center mb-6" aria-label="Oryxa — accueil">
          <OryxaLogo size={52} nameClassName="font-extrabold text-2xl text-[#0a0a0c] dark:text-white" imageClassName="rounded-xl shadow-lg" />
        </Link>

        <div className="glass-card p-8">
          <div className="w-12 h-12 rounded-xl bg-[rgba(225,29,42,0.1)] flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={22} className="text-[#d9524d]" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#0a0a0c] dark:text-white text-center">Confirmez votre email</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1 mb-2">
            Entrez le code à 6 chiffres envoyé à<br /><strong>{email || 'votre adresse email'}</strong>
          </p>

          <div className={`flex items-center justify-center gap-1.5 text-xs font-medium mb-6 ${expire ? 'text-[#b23c37]' : 'text-gray-400 dark:text-gray-500'}`}>
            <Clock size={13} />
            {expire ? 'Code expiré — demandez-en un nouveau' : `Expire dans ${minutes}:${String(secondes).padStart(2, '0')}`}
          </div>

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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { boxRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  disabled={expire}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                  className="fs-otp-box"
                />
              ))}
            </div>

            <button type="submit" className="btn-primary w-full justify-center" disabled={loading || code.length !== 6 || expire}>
              {loading && <span className="spinner" style={{ width: 16, height: 16 }} />}
              Confirmer <ArrowRight size={18} />
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Aucun code reçu ?{' '}
            <button onClick={handleResend} disabled={resending} className="font-semibold text-[#d9524d] hover:underline disabled:opacity-50">
              {resending ? 'Envoi...' : 'Renvoyer le code'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-5">
          <Link to="/login" className="hover:text-[#d9524d]">← Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
