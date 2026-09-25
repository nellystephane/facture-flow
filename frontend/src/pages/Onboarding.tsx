import { useRef, useState } from 'react';
import OryxaLogo from '../components/OryxaLogo';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BellRing, CreditCard, FileText, LayoutDashboard, UsersRound } from 'lucide-react';

interface Ecran {
  icon: typeof FileText;
  etape: string;
  titre: string;
  texte: string;
}

const ECRANS: Ecran[] = [
  {
    icon: UsersRound,
    etape: 'Vos clients',
    titre: 'Retrouvez vos clients sans repartir de zéro.',
    texte: 'Gardez les informations utiles au même endroit et réutilisez-les quand vous préparez un document.',
  },
  {
    icon: FileText,
    etape: 'Vos documents',
    titre: 'Créez des devis et factures qui vous ressemblent.',
    texte: 'Présentez vos prestations, vos montants et votre identité dans des documents structurés et professionnels.',
  },
  {
    icon: CreditCard,
    etape: 'Le paiement',
    titre: 'Donnez à votre client un parcours clair pour payer.',
    texte: 'Votre client accède à sa page de paiement depuis le lien partagé, sans devoir créer un compte Oryxa.',
  },
  {
    icon: BellRing,
    etape: 'Le suivi',
    titre: 'Voyez ce qui est réglé et ce qui reste à recevoir.',
    texte: 'Oryxa rassemble les informations utiles pour suivre vos encaissements et vos échéances.',
  },
  {
    icon: LayoutDashboard,
    etape: 'Votre activité',
    titre: 'Une seule vue pour garder le contrôle.',
    texte: 'Clients, documents, paiements et activité restent accessibles depuis votre espace, sur téléphone comme sur ordinateur.',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const dernier = ECRANS.length;
  const [etape, setEtape] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const terminer = (destination: '/register' | '/login') => {
    localStorage.setItem('oryxa_onboarding_v1', 'done');
    navigate(destination);
  };
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

  const ecran = ECRANS[etape];
  const Icon = ecran.icon;

  return (
    <div className="dark">
      <div className="onboarding-shell app-bg" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
        <div className="onboarding-content relative z-10">
          <header className="onboarding-topbar">
            <OryxaLogo size={38} nameClassName="font-extrabold text-lg text-white" />
            <button type="button" onClick={() => terminer('/login')} className="onboarding-skip">J’ai déjà un compte</button>
          </header>

          <div className="onboarding-progress" aria-label={`Étape ${etape + 1} sur ${dernier + 1}`}>
            {Array.from({ length: dernier + 1 }).map((_, i) => <span key={i} className={i <= etape ? 'active' : ''} />)}
          </div>

          <main className="onboarding-stage" key={etape}>
            <div className="onboarding-visual">
              <div className="onboarding-icon-glow" />
              {etape === 0 ? (
                <OryxaLogo size={92} showName={false} imageClassName="rounded-[26px] shadow-2xl" />
              ) : (
                <div className="onboarding-icon-card"><Icon size={38} strokeWidth={1.8} /></div>
              )}
            </div>
            <div className="onboarding-copy">
              <span className="onboarding-kicker">{etape === 0 ? 'Bienvenue sur Oryxa' : `Étape ${etape} · ${ecran.etape}`}</span>
              <h1>{etape === 0 ? 'Votre activité mérite mieux qu’une gestion dispersée.' : ecran.titre}</h1>
              <p>{etape === 0 ? 'Devis, factures, paiements et suivi : Oryxa vous aide à remettre les pièces essentielles de votre activité au même endroit.' : ecran.texte}</p>
            </div>

            {etape === dernier && (
              <div className="onboarding-final-actions">
                <button onClick={() => terminer('/register')} className="btn-primary w-full justify-center text-base py-3.5">Créer mon compte gratuitement <ArrowRight size={18} /></button>
                <button onClick={() => terminer('/login')} className="onboarding-login-action">J’ai déjà un compte</button>
                <p>Vous pourrez commencer avec vos informations réelles, sans carte bancaire.</p>
              </div>
            )}
          </main>

          <footer className="onboarding-footer">
            <button type="button" onClick={precedent} className={etape === 0 ? 'onboarding-nav disabled' : 'onboarding-nav'} disabled={etape === 0}>
              <ArrowLeft size={17} /> Retour
            </button>
            {etape < dernier ? (
              <button type="button" onClick={suivant} className="onboarding-next">Suivant <ArrowRight size={18} /></button>
            ) : <span className="onboarding-end-note">Prêt quand vous l’êtes.</span>}
          </footer>
        </div>
      </div>
    </div>
  );
}
