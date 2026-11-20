import { Link } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { ArrowRight, BellRing, Banknote, BarChart3, FileText, Plus, Send, Users, Wallet, X, ShieldCheck, Smartphone, Lock } from 'lucide-react';
import OryxaLogo from '../components/OryxaLogo';
import Reveal from '../components/ui/Reveal';
import { TemplateThumb } from '../components/TemplatePicker';

/*
 * Hiérarchie de couleur (chaque couleur a UN rôle) :
 *  rouge  = agir / marque (boutons, soulignement)
 *  encre  = structure et texte
 *  vert   = argent entré, payé
 *  ambre  = en attente, à relancer
 *  bleu   = s'organiser, comprendre (clients, chiffres)
 */
type Tone = 'rouge' | 'vert' | 'ambre' | 'bleu';

const ETAPES: { n: string; titre: string; texte: string; tone: Tone }[] = [
  { n: '1', titre: 'Créez', texte: 'Un client, vos prestations, et le PDF est prêt. Numéros et totaux se font tout seuls.', tone: 'rouge' },
  { n: '2', titre: 'Envoyez', texte: 'Par e-mail ou WhatsApp, avec un bouton Payer directement dans la facture.', tone: 'bleu' },
  { n: '3', titre: 'Encaissez', texte: 'Votre client règle en Mobile Money ou par carte. L’argent arrive sur votre solde.', tone: 'vert' },
];

const GAINS: { titre: string; texte: string; tone: Tone; icon: typeof FileText }[] = [
  { titre: 'Une facture en quelques clics', texte: 'Choisissez le client, ajoutez vos prestations, c’est parti. Les numéros, les totaux et le PDF se font tout seuls.', tone: 'rouge', icon: FileText },
  { titre: 'Un client qui paie en la recevant', texte: 'La facture arrive avec un bouton Payer. Votre client règle depuis son téléphone, sans créer de compte.', tone: 'vert', icon: Wallet },
  { titre: 'Les relances, c’est Oryxa', texte: 'Une facture en retard ? Votre client reçoit un rappel à 3, 7 et 15 jours. Vous n’avez plus à vous justifier de relancer.', tone: 'ambre', icon: BellRing },
  { titre: 'Tous vos clients au même endroit', texte: 'Coordonnées, devis, factures, paiements : tout l’historique d’un client en une page.', tone: 'bleu', icon: Users },
  { titre: 'Votre activité d’un coup d’œil', texte: 'Chiffre d’affaires, factures en attente, impayés, meilleurs clients. Sans sortir la calculatrice.', tone: 'bleu', icon: BarChart3 },
  { titre: 'Votre argent, quand vous voulez', texte: 'Les paiements s’ajoutent à votre solde. Vous voyez ce qui est disponible et vous demandez votre retrait.', tone: 'vert', icon: Banknote },
];

const MODELES = [
  { id: 'classique', nom: 'Classique' }, { id: 'atelier', nom: 'Atelier' }, { id: 'horizon', nom: 'Horizon' },
  { id: 'prestige', nom: 'Prestige' }, { id: 'corporate', nom: 'Corporate' }, { id: 'noir', nom: 'Noir' },
];

const METIERS = ['Freelances et consultants', 'Artisans et prestataires', 'Commerçants et grossistes', 'Petites entreprises et agences'];

const CONFIANCE: [string, string, typeof Lock][] = [
  ['Vos données restent les vôtres', 'Vos clients et vos factures ne sont visibles que par vous et votre équipe.', Lock],
  ['Paiements via FedaPay', 'Mobile Money et cartes, via un service de paiement reconnu dans la région.', ShieldCheck],
  ['Sur téléphone comme sur ordinateur', 'Créez, envoyez et suivez depuis votre poche. Installez-le comme une application.', Smartphone],
];

const FAQ = [
  { q: 'Mon client doit-il créer un compte pour payer ?', a: 'Non. Il ouvre le lien reçu avec la facture, choisit son moyen de paiement et règle. C’est tout.' },
  { q: 'Quels moyens de paiement mes clients peuvent-ils utiliser ?', a: 'MTN Money, Moov Money et carte bancaire. Si un client vous paie en espèces ou par virement, vous l’enregistrez vous-même en une ligne.' },
  { q: 'Combien ça coûte ?', a: 'Le plan gratuit permet de commencer : 5 factures, 5 devis et 20 clients par mois. Les plans Pro et Business enlèvent ces limites et ajoutent les relances automatiques, les statistiques avancées et le travail en équipe.' },
  { q: 'Et pour la facture normalisée de la DGI ?', a: 'Elle est en cours de test chez nous. Nous l’annoncerons le jour où elle sera ouverte à tous, pas avant.' },
  { q: 'Est-ce que je peux l’utiliser seul ?', a: 'Oui, c’est même fait pour ça. L’équipe (plusieurs utilisateurs) arrive avec le plan Business.' },
  { q: 'Ça remplace mon comptable ?', a: 'Non, mais ça lui évite de vous demander où est passée la facture du 14.' },
];

function FaqItem({ item, open, onToggle }: { item: (typeof FAQ)[number]; open: boolean; onToggle: () => void }) {
  return (
    <div className={`lp-faq-item ${open ? 'is-open' : ''}`}>
      <button type="button" onClick={onToggle} className="lp-faq-q" aria-expanded={open}>
        <span>{item.q}</span>
        {open ? <X size={18} /> : <Plus size={18} />}
      </button>
      {open && <div className="lp-faq-a">{item.a}</div>}
    </div>
  );
}

/** Aperçu de produit : une vraie facture, un bouton Payer, deux notifications. Purement illustratif. */
function HeroMockup(): ReactNode {
  return (
    <div className="lp-mock" aria-hidden="true">
      <div className="lp-mock-doc">
        <div className="lp-mock-top">
          <div><p className="lp-mock-k">Facture</p><p className="lp-mock-n">F-2026-014</p></div>
          <span className="lp-pill lp-pill-vert">Payée</span>
        </div>
        <div className="lp-mock-client"><span className="lp-avatar">KA</span><div><p>Kossi Agbo</p><small>Cotonou</small></div></div>
        <div className="lp-mock-lines">
          <div><span>Création du logo</span><b>80 000</b></div>
          <div><span>Charte graphique</span><b>120 000</b></div>
          <div><span>Déclinaisons réseaux</span><b>45 000</b></div>
        </div>
        <div className="lp-mock-total"><span>Total</span><b>245 000 F</b></div>
        <div className="lp-mock-pay"><Send size={14} /> Payer en ligne</div>
      </div>
      <div className="lp-float lp-float-a"><span className="lp-dot lp-dot-vert" /><div><b>+ 245 000 F</b><small>Paiement reçu · MTN Money</small></div></div>
      <div className="lp-float lp-float-b"><span className="lp-dot lp-dot-ambre" /><div><b>Relance envoyée</b><small>Facture F-2026-011 · J+3</small></div></div>
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
          <a href="#gains" className="lp-link">Fonctionnalités</a>
          <a href="#faq" className="lp-link">Questions</a>
          <Link to="/login" className="lp-link">Se connecter</Link>
          <Link to="/register" className="btn-primary lp-btn-sm">Créer mon compte</Link>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-grid">
            <div className="fx-stagger">
              <p className="lp-kicker"><span className="lp-kicker-dot" /> Facturation et gestion pour freelances, commerçants et PME</p>
              <h1>
                Facturez.
                <br />
                Soyez payé.
                <br />
                <span className="lp-underline">Sans courir.</span>
              </h1>
              <p className="lp-lead">
                Vos devis, vos factures, vos clients et vos paiements au même endroit. Vous créez, vous envoyez, votre client paie en ligne, et vous suivez tout depuis un seul tableau de bord.
              </p>
              <div className="lp-actions">
                <Link to="/register" className="btn-primary lp-btn">Créer mon compte gratuit <ArrowRight size={18} /></Link>
                <a href="#etapes" className="lp-link-quiet">Voir comment ça marche</a>
              </div>
              <p className="lp-reassure">Gratuit pour démarrer · sans carte bancaire</p>
            </div>
            <HeroMockup />
          </div>
          <ul className="lp-rails" aria-label="Moyens de paiement acceptés">
            <li><span className="lp-rail lp-rail-mtn" />MTN Money</li>
            <li><span className="lp-rail lp-rail-moov" />Moov Money</li>
            <li><span className="lp-rail lp-rail-card" />Cartes bancaires</li>
            <li><span className="lp-rail lp-rail-fp" />via FedaPay</li>
          </ul>
        </section>

        <section id="etapes" className="lp-section">
          <Reveal><p className="lp-eyebrow">Le parcours</p><h2 className="lp-h2">Trois gestes, du devis à l’argent sur votre solde.</h2></Reveal>
          <div className="lp-steps">
            {ETAPES.map((e, i) => (
              <Reveal key={e.n} delay={i * 110} className={`lp-step tone-${e.tone}`}>
                <span className="lp-step-n">{e.n}</span>
                <h3>{e.titre}</h3>
                <p>{e.texte}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="gains" className="lp-section lp-section-tint">
          <Reveal><p className="lp-eyebrow">Ce que vous gagnez</p><h2 className="lp-h2">Tout ce qu’il faut pour gérer votre activité, sans jongler entre dix outils.</h2></Reveal>
          <div className="lp-gains">
            {GAINS.map((g, i) => (
              <Reveal key={g.titre} delay={(i % 3) * 100} className={`lp-gain tone-${g.tone}`}>
                <span className="lp-gain-ico"><g.icon size={20} /></span>
                <h3>{g.titre}</h3>
                <p>{g.texte}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="lp-section">
          <Reveal>
            <p className="lp-eyebrow">Vos documents</p>
            <h2 className="lp-h2">Des factures qui ont de la tenue, pas un tableau Excel imprimé.</h2>
            <p className="lp-sub">Neuf modèles dessinés un par un : sobre, éditorial, institutionnel… Choisissez celui qui vous ressemble, vos clients le verront.</p>
          </Reveal>
          <div className="lp-models">
            {MODELES.map((m, i) => (
              <Reveal key={m.id} delay={i * 70} className="lp-model">
                <div className="lp-model-page"><TemplateThumb id={m.id} /></div>
                <span>{m.nom}</span>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="lp-section lp-section-sand">
          <Reveal><p className="lp-eyebrow">Pour qui</p><h2 className="lp-h2">Pensé pour ceux qui vendent leur travail.</h2></Reveal>
          <ul className="lp-metiers">
            {METIERS.map((m, i) => (
              <Reveal as="li" key={m} delay={i * 80}>{m}</Reveal>
            ))}
          </ul>
        </section>

        <section className="lp-section">
          <Reveal><p className="lp-eyebrow">Confiance</p><h2 className="lp-h2">Vous pouvez compter dessus.</h2></Reveal>
          <div className="lp-piliers">
            {CONFIANCE.map(([titre, texte, Icon], i) => (
              <Reveal key={titre} delay={i * 120} className="lp-pilier">
                <Icon size={22} className="lp-pilier-ico" />
                <h3>{titre}</h3>
                <p>{texte}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="faq" className="lp-section lp-faq">
          <Reveal><p className="lp-eyebrow">Questions</p><h2 className="lp-h2">Questions fréquentes</h2></Reveal>
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
            <div className="lp-final-card">
              <h2>Votre prochaine facture, faites-la avec Oryxa.</h2>
              <p>Créez votre compte gratuit, ajoutez un client, envoyez la facture. Cinq minutes suffisent.</p>
              <Link to="/register" className="lp-btn-light">Créer mon compte gratuit <ArrowRight size={18} /></Link>
            </div>
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
