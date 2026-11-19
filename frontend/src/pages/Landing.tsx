import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, Check, Plus, X } from 'lucide-react';
import OryxaLogo from '../components/OryxaLogo';
import Reveal from '../components/ui/Reveal';

const GAINS = [
  {
    titre: 'Une facture en quelques clics',
    texte: 'Choisissez le client, ajoutez vos prestations, c’est parti. Les numéros, les totaux et le PDF se font tout seuls.',
  },
  {
    titre: 'Un client qui paie en la recevant',
    texte: 'La facture arrive avec un bouton Payer. Votre client règle en Mobile Money ou par carte, depuis son téléphone, sans créer de compte.',
  },
  {
    titre: 'Tous vos clients au même endroit',
    texte: 'Coordonnées, devis, factures, paiements : tout l’historique d’un client en une page, plus besoin de fouiller vos conversations.',
  },
  {
    titre: 'Votre activité d’un coup d’œil',
    texte: 'Chiffre d’affaires, factures en attente, impayés, meilleurs clients. Vous savez où vous en êtes sans sortir la calculatrice.',
  },
  {
    titre: 'Les relances, c’est Oryxa',
    texte: 'Une facture en retard ? Votre client reçoit un rappel à 3, 7 et 15 jours. Vous n’avez plus à vous justifier de relancer.',
  },
  {
    titre: 'Votre argent, quand vous voulez',
    texte: 'Les paiements s’ajoutent à votre solde. Vous voyez ce qui est disponible et vous demandez votre retrait.',
  },
];

const METIERS = [
  'Freelances et consultants',
  'Artisans et prestataires de services',
  'Commerçants et grossistes',
  'Petites entreprises et agences',
];

const CONFIANCE = [
  ['Vos données restent les vôtres', 'Vos clients et vos factures sont protégés et ne sont visibles que par vous et votre équipe.'],
  ['Des paiements qui passent par FedaPay', 'Mobile Money et cartes, via un service de paiement reconnu dans la région.'],
  ['Sur téléphone comme sur ordinateur', 'Créez, envoyez et suivez depuis votre poche. Installez-le comme une application.'],
];

const FAQ = [
  {
    q: 'Mon client doit-il créer un compte pour payer ?',
    a: 'Non. Il ouvre le lien reçu avec la facture, choisit son moyen de paiement et règle. C’est tout.',
  },
  {
    q: 'Quels moyens de paiement mes clients peuvent-ils utiliser ?',
    a: 'MTN Money, Moov Money et carte bancaire. Si un client vous paie en espèces ou par virement, vous l’enregistrez vous-même en une ligne.',
  },
  {
    q: 'Combien ça coûte ?',
    a: 'Le plan gratuit permet de commencer : 5 factures, 5 devis et 20 clients par mois. Les plans Pro et Business enlèvent ces limites et ajoutent les relances automatiques, les statistiques avancées et le travail en équipe.',
  },
  {
    q: 'Et pour la facture normalisée de la DGI ?',
    a: 'Elle est en cours de test chez nous. Nous l’annoncerons le jour où elle sera ouverte à tous, pas avant.',
  },
  {
    q: 'Est-ce que je peux l’utiliser seul ?',
    a: 'Oui, c’est même fait pour ça. L’équipe (plusieurs utilisateurs) arrive avec le plan Business.',
  },
  {
    q: 'Ça remplace mon comptable ?',
    a: 'Non, mais ça lui évite de vous demander où est passée la facture du 14.',
  },
];

function FaqItem({ item, open, onToggle }: { item: (typeof FAQ)[number]; open: boolean; onToggle: () => void }) {
  return (
    <div className="lp-faq-item">
      <button type="button" onClick={onToggle} className="lp-faq-q" aria-expanded={open}>
        <span>{item.q}</span>
        {open ? <X size={18} /> : <Plus size={18} />}
      </button>
      {open && <div className="lp-faq-a">{item.a}</div>}
    </div>
  );
}

export default function Landing() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <div className="lp-page">
      <header className="lp-header">
        <Link to="/" aria-label="Oryxa, accueil" className="shrink-0">
          <OryxaLogo size={38} nameClassName="font-extrabold text-xl text-[#0a0a0c]" />
        </Link>
        <nav className="lp-nav">
          <Link to="/login" className="lp-link">Se connecter</Link>
          <Link to="/register" className="btn-primary lp-btn-sm">Créer mon compte</Link>
        </nav>
      </header>

      <main>
        <section className="lp-hero fx-stagger">
          <p className="lp-kicker">Facturation et gestion pour freelances, commerçants et PME</p>
          <h1>
            Gagnez du temps
            <br />
            avec <span className="lp-underline">Oryxa</span>.
          </h1>
          <p className="lp-lead">
            Vos devis, vos factures, vos clients et vos paiements au même endroit. Vous créez, vous envoyez, votre client paie en ligne, et vous suivez tout depuis un seul tableau de bord.
          </p>
          <div className="lp-actions">
            <Link to="/register" className="btn-primary lp-btn">
              Créer mon compte gratuit <ArrowRight size={18} />
            </Link>
            <a href="#gains" className="lp-link-quiet">Voir ce que vous gagnez</a>
          </div>
        </section>

        <section id="gains" className="lp-section lp-section-tint">
          <Reveal>
            <h2 className="lp-h2">Tout ce qu’il faut pour gérer votre activité, sans jongler entre dix outils.</h2>
          </Reveal>
          <div className="lp-gains">
            {GAINS.map((g, i) => (
              <Reveal key={g.titre} delay={(i % 3) * 100} className="lp-gain">
                <Check size={18} className="lp-gain-check" />
                <h3>{g.titre}</h3>
                <p>{g.texte}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="lp-section">
          <Reveal>
            <h2 className="lp-h2">Pensé pour ceux qui vendent leur travail.</h2>
          </Reveal>
          <ul className="lp-metiers">
            {METIERS.map((m, i) => (
              <Reveal as="li" key={m} delay={i * 80}>{m}</Reveal>
            ))}
          </ul>
        </section>

        <section className="lp-section lp-section-tint">
          <Reveal>
            <h2 className="lp-h2">Vous pouvez compter dessus.</h2>
          </Reveal>
          <div className="lp-piliers">
            {CONFIANCE.map(([titre, texte], i) => (
              <Reveal key={titre} delay={i * 120} className="lp-pilier">
                <h3>{titre}</h3>
                <p>{texte}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="faq" className="lp-section lp-faq">
          <Reveal>
            <h2 className="lp-h2">Questions fréquentes</h2>
          </Reveal>
          <Reveal delay={100}>
            <div>
              {FAQ.map((item, i) => (
                <FaqItem key={item.q} item={item} open={faqOpen === i} onToggle={() => setFaqOpen(faqOpen === i ? null : i)} />
              ))}
            </div>
          </Reveal>
        </section>

        <section className="lp-final">
          <Reveal>
            <h2>Votre prochaine facture, faites-la avec Oryxa.</h2>
            <p>Créez votre compte gratuit, ajoutez un client, envoyez la facture. Cinq minutes suffisent.</p>
            <Link to="/register" className="btn-primary lp-btn">
              Créer mon compte gratuit <ArrowRight size={18} />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="lp-footer">
        <OryxaLogo size={30} nameClassName="font-bold text-base text-[#0a0a0c]" />
        <div className="lp-footer-links">
          <a href="#faq">Questions</a>
          <Link to="/affiliation">Parrainage</Link>
          <Link to="/cgu">CGU</Link>
          <Link to="/confidentialite">Confidentialité</Link>
          <Link to="/mentions-legales">Mentions légales</Link>
        </div>
        <p>© {new Date().getFullYear()} Oryxa</p>
      </footer>
    </div>
  );
}
