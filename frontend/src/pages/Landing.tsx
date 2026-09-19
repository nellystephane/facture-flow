import { Link } from 'react-router-dom';
import OryxaLogo from '../components/OryxaLogo';
import { ArrowRight, CheckCircle2, CreditCard, FileText, RefreshCw, TrendingUp, Wallet } from 'lucide-react';

const ETAPES = [
  { icon: FileText, titre: 'Facturez', texte: 'Devis et factures professionnels en quelques secondes.' },
  { icon: CreditCard, titre: 'Encaissez', texte: 'Votre client paie en ligne depuis son lien de facture.' },
  { icon: RefreshCw, titre: 'Relancez', texte: 'Les paiements en attente ne disparaissent plus dans vos messages.' },
  { icon: TrendingUp, titre: 'Pilotez', texte: 'Suivez ce qui est encaissé et ce qui reste à recevoir.' },
];

export default function Landing() {
  return (
    <div className="app-bg min-h-screen">
      <div className="orb orb-1" /><div className="orb orb-2" />
      <header className="relative z-10 max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
        <Link to="/" aria-label="Oryxa — accueil"><OryxaLogo size={40} nameClassName="font-extrabold text-xl text-[#0a0a0c] dark:text-white" /></Link>
        <div className="flex items-center gap-2"><Link to="/login" className="btn-ghost text-sm">Se connecter</Link><Link to="/register" className="btn-primary text-sm">Commencer</Link></div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-5 pb-20">
        <section className="text-center pt-16 md:pt-24 pb-16 max-w-4xl mx-auto">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-semibold text-gray-600 dark:text-gray-300">Facturation • Paiement • Suivi</span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[#0a0a0c] dark:text-white mt-5 leading-tight">Votre travail mérite d’être payé.<br /><span className="text-[#d9524d]">Oryxa s’occupe du reste.</span></h1>
          <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mt-6 max-w-2xl mx-auto leading-relaxed">Créez vos devis et factures, envoyez-les, faites-vous payer en ligne, relancez automatiquement vos clients et gardez une vision claire de votre activité.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8"><Link to="/register" className="btn-primary text-base px-6 py-3.5 w-full sm:w-auto justify-center">Commencer gratuitement <ArrowRight size={18} /></Link><a href="#comment" className="btn-ghost text-base px-6 py-3.5 w-full sm:w-auto justify-center">Voir comment ça marche</a></div>
          <p className="text-xs text-gray-400 mt-3">Pas besoin d'être expert en comptabilité.</p>
        </section>

        <section id="comment" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {ETAPES.map(({ icon: Icon, titre, texte }, i) => <div key={titre} className="glass-card p-5"><div className="w-11 h-11 rounded-xl flex items-center justify-center text-white mb-4" style={{ background: 'linear-gradient(135deg,#d9524d,#b23c37)' }}><Icon size={20} /></div><p className="text-xs text-gray-400 mb-1">0{i + 1}</p><h2 className="font-bold text-[#0a0a0c] dark:text-white">{titre}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{texte}</p></div>)}
        </section>

        <section className="grid lg:grid-cols-2 gap-6 items-stretch">
          <div className="glass-card p-7 md:p-9"><p className="text-sm font-bold text-[#d9524d] mb-2">Moins d’administratif</p><h2 className="text-2xl md:text-3xl font-extrabold text-[#0a0a0c] dark:text-white">Arrêtez de courir après vos paiements.</h2><p className="text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">Oryxa suit vos factures, facilite le paiement et peut relancer vos clients lorsqu’une échéance tarde. Vous gardez votre temps pour votre vrai travail.</p><div className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-300">{['Paiement en ligne sans compte client', 'Reçu généré automatiquement', 'Relances automatiques', 'Suivi des factures et encaissements'].map(x => <p key={x} className="flex gap-2"><CheckCircle2 size={17} className="text-green-600 shrink-0" />{x}</p>)}</div></div>
          <div className="rounded-3xl p-7 md:p-9 text-white" style={{ background: 'linear-gradient(135deg,#17171b,#09090b)' }}><Wallet size={24} className="text-[#f4847d]" /><p className="text-sm font-bold text-gray-300 mt-5">Une vision simple de votre argent</p><h2 className="text-2xl md:text-3xl font-extrabold mt-2">Encaissez. Suivez. Retirez.</h2><p className="text-gray-400 mt-3 leading-relaxed">Votre tableau de bord distingue ce que vos clients vous doivent, ce qui est encaissé et votre solde réellement retirable.</p><div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/5 border border-white/10 p-4"><p className="text-xs text-gray-500">À encaisser</p><p className="font-bold mt-1">Vos factures en attente</p></div><div className="rounded-2xl bg-white/5 border border-white/10 p-4"><p className="text-xs text-gray-500">Retirable</p><p className="font-bold mt-1">Votre prochain reversement</p></div></div></div>
        </section>

        <section className="text-center pt-20"><h2 className="text-3xl font-extrabold text-[#0a0a0c] dark:text-white">Votre prochaine facture peut être la première.</h2><Link to="/register" className="btn-primary inline-flex mt-6 px-7 py-3.5">Créer mon compte <ArrowRight size={18} /></Link></section>
      </main>
    </div>
  );
}
