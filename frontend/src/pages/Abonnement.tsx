import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, Loader2, Minus, ChevronDown, Zap, TrendingUp } from 'lucide-react';
import { getPlans, getComparatif, subscribe } from '../api/subscription';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useToast } from '../contexts/ToastContext';
import { formatFCFA, apiError } from '../utils/format';
import InfoHint from '../components/ui/InfoHint';
import type { SubscriptionPlan, ComparatifLigne } from '../types';

export default function Abonnement() {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [comparatif, setComparatif] = useState<ComparatifLigne[]>([]);
  const [showComparatif, setShowComparatif] = useState(false);
  const [loading, setLoading] = useState(true);
  const [duree, setDuree] = useState<'6mois' | '1an'>('1an');
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPlans(), getComparatif()])
      .then(([p, c]) => {
        setPlans(p.data.plans);
        setComparatif(c.data.lignes);
      })
      .finally(() => setLoading(false));
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

  if (loading) return <div className="h-96 skeleton max-w-4xl mx-auto" />;

  const peutGererAbonnement = user?.role !== 'collaborateur';
  const facturation = permissions?.facturation;
  const pourcentageUsage = facturation && !facturation.illimitee
    ? Math.min(100, Math.round((facturation.utilisees / (facturation.limite || 1)) * 100))
    : 0;
  const procheLimit = facturation && !facturation.illimitee && facturation.utilisees >= (facturation.limite || 0) * 0.7;

  return (
    <div className="max-w-4xl mx-auto">
      {/* ===== Statut actuel de l'abonnement ===== */}
      <div className="glass-card p-6 mb-8 animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase font-semibold">Plan actuel</p>
            <p className="text-2xl font-extrabold text-[#0a0a0c] capitalize">{permissions?.planNom || 'Gratuit'}</p>
          </div>
          {user?.subscription && user.subscription !== 'gratuit' && user.estPremium && (
            <span className="badge badge-payee">
              Actif{user.abonnement?.dateFin ? ` jusqu'au ${new Date(user.abonnement.dateFin).toLocaleDateString('fr-FR')}` : ''}
            </span>
          )}
          {user?.subscription && user.subscription !== 'gratuit' && !user.estPremium && (
            <span className="badge badge-en_retard">
              Expiré{user.abonnement?.dateFin ? ` le ${new Date(user.abonnement.dateFin).toLocaleDateString('fr-FR')}` : ''}
            </span>
          )}
        </div>

        {facturation && (
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-gray-500 flex items-center gap-1.5">
                Factures ce mois-ci
                <InfoHint text="Le compteur se remet à zéro le 1er de chaque mois. Vos anciennes factures ne sont jamais supprimées." />
              </span>
              <span className="font-semibold text-[#0a0a0c]">
                {facturation.illimitee ? `${facturation.utilisees} — illimité` : `${facturation.utilisees} / ${facturation.limite}`}
              </span>
            </div>
            {!facturation.illimitee && (
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pourcentageUsage}%`,
                    background: pourcentageUsage >= 100 ? '#dc2626' : procheLimit ? '#f59e0b' : 'linear-gradient(135deg,#d9524d,#b23c37)',
                  }}
                />
              </div>
            )}
            {procheLimit && !facturation.illimitee && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5">
                <TrendingUp size={13} /> Vous approchez de votre limite mensuelle. Passez à Pro pour créer des factures illimitées.
              </p>
            )}
          </div>
        )}

        {!peutGererAbonnement && (
          <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
            Seul le propriétaire du compte peut modifier l'abonnement.
          </p>
        )}
      </div>

      {peutGererAbonnement && (
        <>
          <div className="text-center mb-8 animate-fade-up">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#0a0a0c] mb-2">Choisissez votre plan</h1>
            <p className="text-gray-500 max-w-xl mx-auto">
              Gratuit pour découvrir, Pro pour gagner du temps, Business pour gérer une équipe.
            </p>
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

          <div className="grid md:grid-cols-3 gap-5">
            {plans.map((plan) => {
              const estPlanActuel = permissions?.plan === plan.id;
              const option = plan.options?.find((o) => o.duree === duree);
              const prixMensuel = option ? Math.round(option.prix / option.mois) : 0;
              return (
                <div key={plan.id} className={`glass-card p-6 animate-fade-up relative overflow-hidden ${plan.recommande ? 'ring-2 ring-[#d9524d]' : ''}`}>
                  {plan.recommande && (
                    <span className="absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded-full bg-[#d9524d]/10 text-[#d9524d] inline-flex items-center gap-1">
                      <Sparkles size={11} /> Recommandé
                    </span>
                  )}
                  <h3 className="text-lg font-extrabold text-[#0a0a0c] mb-1">{plan.nom}</h3>
                  <p className="text-xs text-gray-400 mb-3">{plan.accroche}</p>
                  {plan.id === 'gratuit' ? (
                    <div className="mb-5"><span className="text-2xl font-extrabold text-[#0a0a0c]">0 FCFA</span></div>
                  ) : (
                    <>
                      <div className="mb-1">
                        <span className="text-2xl font-extrabold text-[#0a0a0c]">{formatFCFA(option?.prix || 0)}</span>
                        <span className="text-gray-400 text-sm"> / {duree === '1an' ? 'an' : '6 mois'}</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-5">soit environ {formatFCFA(prixMensuel)} / mois</p>
                    </>
                  )}
                  <ul className="space-y-2 mb-6">
                    {plan.avantages.slice(0, 5).map((a) => (
                      <li key={a} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check size={15} className="text-green-600 mt-0.5 shrink-0" /> {a}
                      </li>
                    ))}
                  </ul>
                  {estPlanActuel ? (
                    <div className="btn-ghost w-full justify-center text-sm cursor-default opacity-70">Plan actuel</div>
                  ) : plan.id === 'gratuit' ? (
                    <div className="btn-ghost w-full justify-center text-sm cursor-default opacity-50">Inclus par défaut</div>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.id as 'pro' | 'business')}
                      disabled={subscribing !== null}
                      className="btn-primary w-full justify-center text-sm"
                    >
                      {subscribing === plan.id ? <Loader2 size={16} className="animate-spin" /> : <Zap size={15} />}
                      Choisir {plan.nom}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Comparateur détaillé */}
          <div className="mt-8 animate-fade-up">
            <button
              onClick={() => setShowComparatif((s) => !s)}
              className="btn-ghost text-sm mx-auto flex"
            >
              Voir toutes les fonctionnalités <ChevronDown size={15} className={`transition-transform ${showComparatif ? 'rotate-180' : ''}`} />
            </button>

            {showComparatif && (
              <div className="glass-card overflow-hidden mt-4 animate-fade-in">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100 bg-white/40">
                        <th className="px-5 py-3 font-semibold">Fonctionnalité</th>
                        <th className="px-5 py-3 font-semibold text-center">Gratuit</th>
                        <th className="px-5 py-3 font-semibold text-center">Pro</th>
                        <th className="px-5 py-3 font-semibold text-center">Business</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {comparatif.map((ligne) => (
                        <tr key={ligne.label}>
                          <td className="px-5 py-3 text-gray-700 font-medium">{ligne.label}</td>
                          {[ligne.gratuit, ligne.pro, ligne.business].map((val, i) => (
                            <td key={i} className="px-5 py-3 text-center">
                              {typeof val === 'boolean'
                                ? (val ? <Check size={16} className="text-green-600 mx-auto" /> : <Minus size={16} className="text-gray-300 mx-auto" />)
                                : <span className="text-gray-600">{val}</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
