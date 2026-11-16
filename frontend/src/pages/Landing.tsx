import { Link } from 'react-router-dom';
import OryxaLogo from '../components/OryxaLogo';
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  UsersRound,
  X,
} from 'lucide-react';
import { useState } from 'react';

const ETAPES = [
  {
    icon: UsersRound,
    numero: '01',
    titre: 'Retrouvez votre client',
    texte: 'Gardez vos clients et leurs informations au même endroit. Plus besoin de réécrire les mêmes coordonnées à chaque vente.',
  },
  {
    icon: FileText,
    numero: '02',
    titre: 'Préparez votre devis ou facture',
    texte: 'Créez un document professionnel avec vos prestations, vos montants et votre identité.',
  },
  {
    icon: CreditCard,
    numero: '03',
    titre: 'Envoyez et faites payer',
    texte: 'Votre client reçoit un lien clair vers son document et son parcours de paiement, sans devoir créer un compte Oryxa.',
  },
  {
    icon: BellRing,
    numero: '04',
    titre: 'Suivez sans courir après',
    texte: 'Retrouvez les factures, les paiements et les échéances dans votre espace pour savoir ce qui est réglé et ce qui reste à recevoir.',
  },
];

const FAQ = [
  {
    q: 'Est-ce que je dois changer complètement ma façon de travailler ?',
    a: 'Non. Oryxa est justement pensé pour partir de votre quotidien : vos clients, vos ventes et vos échanges existent déjà. L’objectif est de supprimer la ressaisie et les recherches inutiles, pas de vous imposer une méthode compliquée.',
  },
  {
    q: 'Mon client doit-il créer un compte Oryxa pour payer ?',
    a: 'Non pour le parcours de paiement public. Le client peut accéder au lien qui lui est transmis et effectuer l’opération depuis cette page, sans ouvrir un espace professionnel Oryxa.',
  },
  {
    q: 'Est-ce uniquement pour les grandes entreprises ?',
    a: 'Non. Oryxa vise notamment les indépendants, artisans, freelances, commerçants, prestataires et petites entreprises qui veulent professionnaliser leur gestion sans adopter un outil disproportionné.',
  },
  {
    q: 'Est-ce que je peux continuer à travailler avec mes clients comme avant ?',
    a: 'Oui. Oryxa ne vous demande pas de remplacer toutes vos habitudes. Vous pouvez continuer à échanger avec vos clients par vos canaux habituels tout en utilisant Oryxa pour structurer vos clients, devis, factures et paiements.',
  },
  {
    q: 'Que se passe-t-il si mon client paie autrement ?',
    a: 'Un paiement effectué en dehors du parcours de paiement Oryxa peut être enregistré comme paiement manuel dans votre suivi. Oryxa ne déclenche pas artificiellement un paiement : il distingue ce qui est réellement encaissé de ce qui est simplement déclaré dans votre gestion.',
  },
  {
    q: 'Est-ce qu’Oryxa remplace un comptable ?',
    a: 'Non. Oryxa est un outil de gestion commerciale et de suivi des ventes et paiements. Il aide à mieux organiser votre activité, mais ne prétend pas remplacer les conseils ou obligations relevant d’un professionnel de la comptabilité.',
  },
  {
    q: 'Dans quelle devise travaille Oryxa ?',
    a: 'Oryxa est actuellement centré sur le FCFA. Les montants affichés dans les documents et le suivi restent cohérents dans cette devise au lieu de proposer un changement de devise incomplet.',
  },
  {
    q: 'Puis-je utiliser Oryxa depuis mon téléphone ?',
    a: 'Oui. L’interface est conçue pour être utilisée sur téléphone comme sur ordinateur, avec des parcours adaptés aux petits écrans.',
  },
];

function FaqItem({ item, open, onToggle }: { item: typeof FAQ[number]; open: boolean; onToggle: () => void }) {
  return (
    <div className="landing-faq-item">
      <button type="button" onClick={onToggle} className="landing-faq-question" aria-expanded={open}>
        <span>{item.q}</span>
        {open ? <X size={19} /> : <ChevronDown size={19} />}
      </button>
      {open && <div className="landing-faq-answer">{item.a}</div>}
    </div>
  );
}

export default function Landing() {
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  return (
    <div className="landing-page app-bg min-h-screen">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <header className="landing-header relative z-20">
        <div className="landing-header-inner">
          <Link to="/" aria-label="Oryxa — accueil" className="shrink-0">
            <OryxaLogo size={42} nameClassName="font-extrabold text-xl text-[#0a0a0c] dark:text-white" />
          </Link>
          <Link to="/login" className="landing-login-btn">
            Se connecter <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="landing-hero">
          <div className="landing-eyebrow"><span className="landing-eyebrow-dot" /> Facturation • Paiement • Suivi</div>
          <h1>
            Vous faites le travail.<br />
            <span>Oryxa vous aide à être payé.</span>
          </h1>
          <p className="landing-hero-lead">
            Devis, factures, clients et paiements réunis dans un seul espace pensé pour les indépendants et petites entreprises.
            Moins de recherche. Moins de ressaisie. Plus de visibilité sur votre activité.
          </p>
          <div className="landing-hero-actions">
            <Link to="/register" className="btn-primary landing-main-cta">
              Commencer gratuitement <ArrowRight size={19} />
            </Link>
            <a href="#comment-ca-marche" className="landing-secondary-cta">
              Voir comment ça marche
            </a>
          </div>
          <p className="landing-trust-line">Pas besoin d’être expert en comptabilité pour commencer.</p>

          <div className="landing-hero-preview" aria-label="Aperçu du parcours Oryxa">
            <div className="landing-preview-topbar">
              <div className="flex items-center gap-2"><span className="landing-preview-dot" /><span>Votre activité</span></div>
              <span className="landing-preview-pill">FCFA</span>
            </div>
            <div className="landing-preview-grid">
              <div className="landing-preview-card landing-preview-main">
                <div className="landing-preview-icon"><LayoutDashboard size={18} /></div>
                <div><p className="landing-preview-label">Aujourd’hui</p><p className="landing-preview-title">Une vue claire de votre activité</p></div>
                <div className="landing-preview-lines"><span /><span /><span /></div>
              </div>
              <div className="landing-preview-card">
                <p className="landing-preview-label">Documents</p>
                <p className="landing-preview-number">Devis & factures</p>
                <p className="landing-preview-small">Créés et suivis au même endroit</p>
              </div>
              <div className="landing-preview-card">
                <p className="landing-preview-label">Paiements</p>
                <p className="landing-preview-number">Encaissé / à recevoir</p>
                <p className="landing-preview-small">Un suivi plus lisible</p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-problem-section section-shell">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">Le problème n’est pas votre métier.</span>
            <h2>C’est tout ce qu’il faut faire <span>autour</span> du métier.</h2>
            <p>Un client dans le téléphone. Un devis dans une conversation. Une facture dans un fichier. Une preuve de paiement dans la galerie. Puis on recommence.</p>
          </div>
          <div className="landing-problem-grid">
            {[
              ['Vous perdez du temps', 'à refaire les mêmes documents et rechercher les mêmes informations.'],
              ['Vous perdez de la visibilité', 'quand ventes, paiements et échanges restent dispersés.'],
              ['Vous donnez moins de clarté', 'à votre client quand le devis, la facture et le paiement sont séparés.'],
            ].map(([title, text]) => (
              <div key={title} className="landing-problem-card">
                <span className="landing-problem-mark">×</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="comment-ca-marche" className="section-shell landing-steps-section">
          <div className="landing-section-heading centered">
            <span className="landing-section-kicker">Simple à comprendre. Utile au quotidien.</span>
            <h2>Votre vente, du premier clic au paiement.</h2>
            <p>Oryxa structure les étapes qui se répètent dans votre activité sans vous obliger à devenir gestionnaire de logiciel.</p>
          </div>
          <div className="landing-steps-grid">
            {ETAPES.map(({ icon: Icon, numero, titre, texte }) => (
              <article key={numero} className="landing-step-card">
                <div className="landing-step-number">{numero}</div>
                <div className="landing-step-icon"><Icon size={21} /></div>
                <h3>{titre}</h3>
                <p>{texte}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-shell landing-value-section">
          <div className="landing-value-panel">
            <div className="landing-value-copy">
              <span className="landing-section-kicker">Ce que vous récupérez</span>
              <h2>Votre temps doit servir à travailler. Pas à chercher où est passé le paiement.</h2>
              <p>Oryxa vous donne un même point de repère pour vos clients, vos documents et votre suivi. Vous gardez une vision claire sans multiplier les outils.</p>
              <div className="landing-check-list">
                {[
                  'Clients réutilisables dans vos documents',
                  'Devis et factures structurés et professionnels',
                  'Lien de paiement public pour votre client',
                  'Suivi des paiements et des montants restant à recevoir',
                  'Prévisualisation et identité visuelle de vos documents',
                  'Tableau de bord pour piloter votre activité',
                ].map((item) => <div key={item}><CheckCircle2 size={17} /> <span>{item}</span></div>)}
              </div>
            </div>
            <div className="landing-value-visual">
              <div className="landing-flow-card">
                <div className="landing-flow-head"><span>Le parcours devient lisible</span><span className="landing-preview-pill">FCFA</span></div>
                <div className="landing-flow-row"><span>Client</span><b>✓</b></div>
                <div className="landing-flow-row"><span>Devis / facture</span><b>✓</b></div>
                <div className="landing-flow-row"><span>Paiement</span><b>✓</b></div>
                <div className="landing-flow-row"><span>Suivi</span><b>✓</b></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-shell landing-audience-section">
          <div className="landing-section-heading centered">
            <span className="landing-section-kicker">Pensé pour votre réalité</span>
            <h2>Oryxa n’est pas réservé aux entreprises avec un service administratif.</h2>
            <p>Si vous vendez une prestation, un produit ou votre savoir-faire, vous avez déjà besoin de suivre des clients, des documents et des paiements.</p>
          </div>
          <div className="landing-audience-grid">
            {['Freelances & consultants', 'Artisans & prestataires', 'Commerçants', 'Petites entreprises'].map((item) => (
              <div key={item} className="landing-audience-card"><CheckCircle2 size={18} />{item}</div>
            ))}
          </div>
        </section>

        <section className="section-shell landing-faq-section" id="faq">
          <div className="landing-faq-intro">
            <span className="landing-section-kicker"><HelpCircle size={15} /> Les vraies questions</span>
            <h2>Avant de changer vos habitudes, vous avez le droit d’avoir des réponses.</h2>
            <p>Oryxa doit être clair avant d’être impressionnant.</p>
          </div>
          <div className="landing-faq-list">
            {FAQ.map((item, index) => <FaqItem key={item.q} item={item} open={faqOpen === index} onToggle={() => setFaqOpen(faqOpen === index ? null : index)} />)}
          </div>
        </section>

        <section className="landing-final-cta section-shell">
          <div>
            <span className="landing-section-kicker">Commencez simplement</span>
            <h2>La prochaine fois que vous faites une facture, faites-la avec Oryxa.</h2>
            <p>Créez votre espace et découvrez une façon plus structurée de gérer vos ventes et vos paiements.</p>
          </div>
          <Link to="/register" className="btn-primary landing-main-cta">Commencer gratuitement <ArrowRight size={19} /></Link>
        </section>

        <footer className="landing-footer section-shell">
          <OryxaLogo size={34} />
          <div className="landing-footer-links">
            <a href="#faq">FAQ</a>
            <Link to="/affiliation">Devenir affilié</Link>
            <Link to="/cgu">CGU</Link>
            <Link to="/confidentialite">Confidentialité</Link>
            <Link to="/mentions-legales">Mentions légales</Link>
          </div>
          <p>© {new Date().getFullYear()} Oryxa. Une gestion plus simple pour votre activité.</p>
        </footer>
      </main>
    </div>
  );
}
