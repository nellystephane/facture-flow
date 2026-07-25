import { useEffect, useState } from 'react';
import { Check, Sparkles, Loader2 } from 'lucide-react';
import { getPlans, subscribe } from '../api/subscription';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatFCFA, apiError } from '../utils/format';
import InfoHint from '../components/ui/InfoHint';
import type { SubscriptionPlan } from '../types';

export default function Abonnement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [duree, setDuree] = useState<'6mois' | '1an'>('1an');
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    getPlans().then((res) => setPlans(res.data.plans)).finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (planId: 'pro' | 'business') => {
    setSubscribing(planId);
    try {
      const res = await subscribe(planId, duree);
      window.location.href = res.data.paymentUrl;
    } catch (err) {
      toast(apiError(err), 'error');
      setSubscribing(null);
    }
  };

  if (loading) return <div className="h-96 skeleton" />;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8 animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#0a0a0c] mb-2">Passer en Premium</h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Débloquez la facturation rapide depuis vos tarifs préconçus, le paiement en ligne et les reçus automatiques.
        </p>
        {user?.subscription && user.subscription !== 'gratuit' && (
          <p className="text-sm text-green-600 font-medium mt-2">
            Abonnement actuel : {user.subscription} {user.abonnement?.dateFin ? `(jusqu'au ${new Date(user.abonnement.dateFin).toLocaleDateString('fr-FR')})` : ''}
          </p>
        )}
      </div>

      {/* Sélecteur de durée */}
      <div className="flex items-center justify-center gap-2 mb-8 animate-fade-up">
        <div className="glass-card p-1 inline-flex rounded-full">
          <button
            onClick={() => setDuree('6mois')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${duree === '6mois' ? 'bg-[#0a0a0c] text-white' : 'text-gray-500'}`}
          >
            6 mois
          </button>
          <button
            onClick={() => setDuree('1an')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${duree === '1an' ? 'bg-[#0a0a0c] text-white' : 'text-gray-500'}`}
          >
            1 an <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">plus économique</span>
          </button>
        </div>
        <InfoHint text="À l'année, le tarif mensuel réel est plus bas qu'en engagement 6 mois — c'est le choix le plus avantageux si vous comptez utiliser FactuFlow durablement." />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {plans.map((plan) => {
          const option = plan.options.find((o) => o.duree === duree)!;
          const prixMensuel = Math.round(option.prix / option.mois);
          return (
            <div key={plan.id} className="glass-card p-6 animate-fade-up relative overflow-hidden">
              {plan.id === 'pro' && (
                <span className="absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded-full bg-[#d9524d]/10 text-[#d9524d] inline-flex items-center gap-1">
                  <Sparkles size={11} /> Populaire
                </span>
              )}
              <h3 className="text-lg font-extrabold text-[#0a0a0c] mb-1">{plan.nom}</h3>
              <div className="mb-1">
                <span className="text-2xl font-extrabold text-[#0a0a0c]">{formatFCFA(option.prix)}</span>
                <span className="text-gray-400 text-sm"> / {duree === '1an' ? 'an' : '6 mois'}</span>
              </div>
              <p className="text-xs text-gray-400 mb-5">soit environ {formatFCFA(prixMensuel)} / mois</p>
              <ul className="space-y-2 mb-6">
                {plan.avantages.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check size={15} className="text-green-600 mt-0.5 shrink-0" /> {a}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan.id as 'pro' | 'business')}
                disabled={subscribing !== null}
                className="btn-primary w-full justify-center text-sm"
              >
                {subscribing === plan.id ? <Loader2 size={16} className="animate-spin" /> : null}
                Choisir {plan.nom}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
