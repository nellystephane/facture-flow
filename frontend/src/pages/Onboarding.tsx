import { useState, useRef } from 'react';
import OryxaLogo from '../components/OryxaLogo';
import { useNavigate } from 'react-router-dom';
import { FileText, Wallet, UsersRound, BellRing, ArrowRight } from 'lucide-react';

interface Ecran {
  icon: typeof FileText;
  titre: string;
  texte: string;
}

const ECRANS: Ecran[] = [
  {
    icon: FileText,
    titre: 'Facturez sans perdre votre temps',
    texte: "Créez des devis et des factures professionnels, envoyez-les à vos clients et suivez leur statut en temps réel.",
  },
  {
    icon: Wallet,
    titre: 'Faites-vous payer plus simplement',
    texte: 'Vos clients paient directement en ligne — MTN Money, Moov Money, carte bancaire — et vous recevez un reçu automatique.',
  },
  {
    icon: BellRing,
    titre: 'Ne courez plus après les paiements',
    texte: 'Oryxa suit vos échéances et peut relancer automatiquement vos clients. Votre tableau de bord vous montre ce qui est encaissé, à encaisser et retirable.',
  },
  {
    icon: UsersRound,
    titre: 'Gardez une vision claire de votre activité',
    texte: 'Clients, produits, statistiques et équipe : gérez votre entreprise depuis votre téléphone comme depuis votre ordinateur.',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const terminer = (destination: '/register' | '/login') => { localStorage.setItem('oryxa_onboarding_v1', 'done'); navigate(destination); };
  // 0 = écran de bienvenue (logo), 1..N = écrans fonctionnalités,
  // N+1 = écran final avec les boutons d'action.
  const dernier = ECRANS.length + 1;
  const [etape, setEtape] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const suivant = () => setEtape((e) => Math.min(dernier, e + 1));
  const precedent = () => setEtape((e) => Math.max(0, e - 1));

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -50) suivant();
    if (delta > 50) precedent();
    touchStartX.current = null;
  };

  return (
    <div className="dark">
      <div className="app-bg !min-h-screen flex flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        <div className="relative z-10 flex flex-col min-h-screen px-6 py-8 max-w-md mx-auto w-full">
          {/* Passer */}
          <div className="flex justify-end">
            {etape < dernier && (
              <button
                onClick={() => { localStorage.setItem('oryxa_onboarding_v1', 'done'); setEtape(dernier); }}
                className="text-sm font-medium text-gray-400 hover:text-white transition-soft"
              >
                Passer
              </button>
            )}
          </div>

          {/* Contenu central */}
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 animate-fade-in" key={etape}>
            {etape === 0 && (
              <>
                <OryxaLogo size={112} showName={false} imageClassName="rounded-3xl shadow-2xl animate-scale-in" />
                <div>
                  <h1 className="text-3xl font-extrabold text-white mb-2">Oryxa</h1>
                  <p className="text-gray-400 text-base">Facturez, encaissez et gardez le contrôle de votre activité.</p>
                </div>
              </>
            )}

            {etape >= 1 && etape <= ECRANS.length && (() => {
              const ecran = ECRANS[etape - 1];
              const Icon = ecran.icon;
              return (
                <>
                  <div
                    className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl"
                    style={{ background: 'linear-gradient(135deg,#d9524d,#b23c37)' }}
                  >
                    <Icon size={40} className="text-white" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold text-white mb-3 leading-snug">{ecran.titre}</h2>
                    <p className="text-gray-400 text-base leading-relaxed">{ecran.texte}</p>
                  </div>
                </>
              );
            })()}

            {etape === dernier && (
              <>
                <OryxaLogo size={80} showName={false} imageClassName="rounded-2xl shadow-2xl" />
                <div>
                  <h2 className="text-2xl font-extrabold text-white mb-2">Prêt à commencer ?</h2>
                  <p className="text-gray-400 text-base">Créez votre compte gratuitement, aucune carte requise.</p>
                </div>
                <div className="w-full flex flex-col gap-3 mt-4">
                  <button onClick={() => terminer('/register')} className="btn-primary w-full justify-center text-base py-3.5">
                    Créer un compte <ArrowRight size={18} />
                  </button>
                  <button onClick={() => terminer('/login')} className="btn-ghost w-full justify-center text-base py-3.5">
                    J'ai déjà un compte
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Indicateurs + navigation */}
          {etape < dernier && (
            <div className="flex items-center justify-between pt-6">
              <button
                onClick={precedent}
                className={`text-sm font-medium transition-soft ${etape === 0 ? 'opacity-0 pointer-events-none' : 'text-gray-400 hover:text-white'}`}
              >
                Retour
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: dernier + 1 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: i === etape ? '22px' : '8px',
                      background: i === etape ? 'var(--rouge)' : 'rgba(255,255,255,0.18)',
                    }}
                  />
                ))}
              </div>

              <button onClick={suivant} className="btn-icon">
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {etape === dernier && (
            <p className="text-center text-xs text-gray-500 pt-6">
              En continuant, vous acceptez nos{' '}
              <a href={`${import.meta.env.BASE_URL}cgu`} className="underline hover:text-gray-300">CGU</a>
              {' '}et notre{' '}
              <a href={`${import.meta.env.BASE_URL}confidentialite`} className="underline hover:text-gray-300">politique de confidentialité</a>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
