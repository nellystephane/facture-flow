import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import OryxaLogo from '../components/OryxaLogo';

export default function ConfirmPayout() {
  const { token } = useParams();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setMessage('Lien de confirmation invalide.'); return; }
    api.post(`/payouts/confirm/${encodeURIComponent(token)}`)
      .then((res) => { setState('success'); setMessage(res.data.message); })
      .catch((err) => { setState('error'); setMessage(err.response?.data?.message || 'Ce lien est invalide ou expiré.'); });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-5 bg-[#fafafa] dark:bg-[#0a0a0c]">
      <div className="w-full max-w-md glass-card p-7 text-center">
        <div className="flex justify-center mb-5"><OryxaLogo size={48} nameClassName="font-extrabold text-xl text-[#0a0a0c] dark:text-white" /></div>
        {state === 'loading' && <Loader2 className="mx-auto animate-spin text-[#d9524d]" size={40} />}
        {state === 'success' && <CheckCircle2 className="mx-auto text-green-600" size={48} />}
        {state === 'error' && <AlertTriangle className="mx-auto text-[#d9524d]" size={48} />}
        <h1 className="text-xl font-extrabold mt-4 text-[#0a0a0c] dark:text-white">
          {state === 'success' ? 'Moyen de retrait confirmé' : state === 'error' ? 'Confirmation impossible' : 'Confirmation en cours'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-6">{message || 'Vérification sécurisée du lien Oryxa…'}</p>
        {state === 'success' && <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1"><ShieldCheck size={13} /> Aucun transfert n’a été déclenché par cette confirmation.</p>}
        {state !== 'loading' && <Link to="/login" className="btn-primary inline-flex mt-6">Retour à Oryxa</Link>}
      </div>
    </div>
  );
}
