import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, FileText, Users, Wallet, TrendingUp, Smartphone, Bell,
  Check, ArrowRight, Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPublicStats, type PublicStats } from '../api/public';
import { formatCompact } from '../utils/format';

export default function Landing() {
  const { user } = useAuth();
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    getPublicStats()
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, []);

  // On n'affiche des chiffres que s'ils sont réels et significatifs —
  // jamais de statistiques inventées pour "faire joli".
  const hasRealTraction = !!stats?.ready && stats.totalFactures > 0;

  return (
    <div className="app-bg">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="relative z-10">
        {/* ===== Navbar ===== */}
        <header className="sticky top-0 z-40 px-4 sm:px-6 lg:px-12 py-4">
          <nav className="glass rounded-2xl px-5 py-3 flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg,#e11d2a,#b3121d)' }}
              >
                <Zap size={20} fill="white" />
              </div>
              <span className="font-extrabold text-xl text-[#0a0a0c]">FactuFlow</span>
            </div>
            <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-600">
              <a href="#features" className="hover:text-[#e11d2a] transition-soft">Fonctionnalités</a>
              <a href="#pricing" className="hover:text-[#e11d2a] transition-soft">Tarifs</a>
              <a href="#faq" className="hover:text-[#e11d2a] transition-soft">FAQ</a>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <Link to="/app" className="btn-primary text-sm">Mon espace <ArrowRight size={16} /></Link>
              ) : (
                <>
                  <Link to="/login" className="btn-ghost text-sm hidden sm:inline-flex">Connexion</Link>
                  <Link to="/register" className="btn-primary text-sm">Commencer <ArrowRight size={16} /></Link>
                </>
              )}
            </div>
          </nav>
        </header>

        {/* ===== Hero ===== */}
        <section className="px-4 sm:px-6 lg:px-12 pt-12 pb-20 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6 text-xs font-semibold text-[#e11d2a]">
                <span className="w-2 h-2 rounded-full bg-[#e11d2a] pulse-red" />
                Pensé pour l'Afrique francophone
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold text-[#0a0a0c] leading-[1.05] tracking-tight">
                Vos factures,<br />
                <span className="text-gradient">enfin simples.</span>
              </h1>
              <p className="text-lg text-gray-600 mt-6 max-w-lg leading-relaxed">
                Créez devis et factures en quelques secondes, suivez les paiements Mobile Money,
                relancez automatiquement vos clients. Tout votre business de freelance au même endroit.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link to="/register" className="btn-primary">
                  Démarrer gratuitement <ArrowRight size={18} />
                </Link>
                <a href="#pricing" className="btn-dark">Voir les tarifs</a>
              </div>
              <div className="flex items-center gap-6 mt-8 text-sm text-gray-500">
                <div className="flex items-center gap-1.5"><Check size={16} className="text-green-600" /> 10 factures/mois gratuites</div>
                <div className="flex items-center gap-1.5"><Check size={16} className="text-green-600" /> Sans carte bancaire</div>
              </div>
            </div>

            {/* Illustration du parcours — aucune donnée fictive, juste le principe du produit */}
            <div className="animate-scale-in delay-2">
              <div className="glass-card p-6 max-w-md mx-auto">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-5">Comment ça marche</p>
                <div className="space-y-3">
                  {[
                    { icon: FileText, title: 'Créez un devis', desc: 'En moins de 30 secondes', color: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' },
                    { icon: TrendingUp, title: 'Transformez-le en facture', desc: 'En un seul clic', color: 'linear-gradient(135deg,#e11d2a,#b3121d)' },
                    { icon: Wallet, title: 'Suivez le paiement', desc: 'Mobile Money, virement, espèces', color: 'linear-gradient(135deg,#10b981,#047857)' },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/50 transition-soft animate-fade-up" style={{ animationDelay: `${0.2 + i * 0.12}s` }}>
                      <div className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-white shadow-md" style={{ background: step.color }}>
                        <step.icon size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-[#0a0a0c] text-sm">{step.title}</p>
                        <p className="text-xs text-gray-500">{step.desc}</p>
                      </div>
                      {i < 2 && <ArrowRight size={14} className="ml-auto text-gray-300 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Statistiques réelles =====
            N'affiche que des chiffres calculés automatiquement depuis la base
            de données. Section masquée tant qu'il n'y a pas encore d'activité réelle. */}
        {hasRealTraction && (
          <section className="px-4 sm:px-6 lg:px-12 pb-16 max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { value: `${stats!.totalFactures}`, label: 'Factures créées', icon: FileText },
                { value: `${stats!.totalUtilisateurs}`, label: 'Utilisateurs', icon: Users },
                { value: formatCompact(stats!.totalEncaisse), label: 'Encaissés via FactuFlow', icon: Wallet },
              ].map(({ value, label, icon: Icon }, i) => (
                <div key={i} className="glass-card p-5 text-center animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
                  <Icon className="mx-auto mb-2 text-[#e11d2a]" size={24} />
                  <p className="text-2xl font-extrabold text-[#0a0a0c]">{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== Features ===== */}
        <section id="features" className="px-4 sm:px-6 lg:px-12 py-20 max-w-7xl mx-auto">
          <div className="text-center mb-14 animate-fade-up">
            <p className="text-sm font-bold text-[#e11d2a] uppercase tracking-widest mb-3">Fonctionnalités</p>
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#0a0a0c]">Tout ce qu'il vous faut</h2>
            <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
              Une suite complète pour gérer votre activité de A à Z, sans complexité.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: FileText, title: 'Factures & Devis', desc: 'Créez des documents professionnels en 30 secondes. Transformez un devis en facture en un clic.' },
              { icon: Smartphone, title: 'Mobile Money', desc: 'Encaissez via MTN Money, Moov Money, Wave. Suivez chaque paiement en temps réel.' },
              { icon: Bell, title: 'Relances auto', desc: 'Vos clients relancés automatiquement à J+7, J+15 et J+30. Plus jamais d\'impayés oubliés.' },
              { icon: TrendingUp, title: 'Tableau de bord', desc: 'Visualisez votre chiffre d\'affaires, vos impayés et vos meilleurs clients en un coup d\'œil.' },
              { icon: Wallet, title: 'Suivi des paiements', desc: 'Enregistrez les paiements partiels ou complets et gardez l\'historique à jour.' },
              { icon: Clock, title: 'Gagnez du temps', desc: 'Réutilisez vos produits et services, dupliquez vos factures, automatisez le répétitif.' },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="glass-card p-6 animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg"
                  style={{ background: 'linear-gradient(135deg,#e11d2a,#b3121d)' }}>
                  <Icon size={22} />
                </div>
                <h3 className="text-lg font-bold text-[#0a0a0c] mb-1.5">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== Pricing ===== */}
        <section id="pricing" className="px-4 sm:px-6 lg:px-12 py-20 max-w-7xl mx-auto">
          <div className="text-center mb-14 animate-fade-up">
            <p className="text-sm font-bold text-[#e11d2a] uppercase tracking-widest mb-3">Tarifs</p>
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#0a0a0c]">Un prix pour chaque ambition</h2>
            <p className="text-gray-600 mt-4">Sans engagement. Annulable à tout moment.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {[
              {
                name: 'Gratuit', price: '0', period: '/mois', popular: false,
                features: ['10 factures/mois', 'Clients illimités', 'Devis illimités', 'Export PDF', 'Tableau de bord'],
                cta: 'Commencer',
              },
              {
                name: 'Pro', price: '3 000', period: 'FCFA/mois', popular: true,
                features: ['Factures illimitées', 'Logo & personnalisation', 'Relances automatiques', 'Statistiques avancées', 'Support prioritaire'],
                cta: 'Choisir Pro',
              },
              {
                name: 'Business', price: '8 000', period: 'FCFA/mois', popular: false,
                features: ['Tout le plan Pro', 'Gestion d\'équipe', 'Intégration WhatsApp', 'Mobile Money', 'Export comptable'],
                cta: 'Choisir Business',
              },
            ].map((plan, i) => (
              <div key={i}
                className={`glass-card p-7 flex flex-col animate-fade-up relative ${plan.popular ? 'ring-2 ring-[#e11d2a]' : ''}`}
                style={{ animationDelay: `${i * 0.1}s` }}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold text-white px-4 py-1 rounded-full whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg,#e11d2a,#b3121d)' }}>
                    ★ Le plus populaire
                  </span>
                )}
                <h3 className="text-xl font-bold text-[#0a0a0c]">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-3 mb-1">
                  <span className="text-4xl font-extrabold text-[#0a0a0c]">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>
                <ul className="space-y-3 my-6 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <Check size={18} className="text-green-600 shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className={plan.popular ? 'btn-primary justify-center' : 'btn-dark justify-center'}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" className="px-4 sm:px-6 lg:px-12 py-20 max-w-3xl mx-auto">
          <div className="text-center mb-12 animate-fade-up">
            <p className="text-sm font-bold text-[#e11d2a] uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0a0a0c]">Questions fréquentes</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: 'Est-ce vraiment gratuit ?', a: 'Oui ! Le plan gratuit vous permet de créer jusqu\'à 10 factures par mois, sans carte bancaire.' },
              { q: 'Puis-je accepter les paiements Mobile Money ?', a: 'Absolument. MTN Money, Moov Money et d\'autres moyens sont pris en charge pour le suivi de vos paiements.' },
              { q: 'Mes données sont-elles sécurisées ?', a: 'Vos données sont stockées de façon chiffrée et ne sont jamais partagées. Chaque compte est isolé.' },
              { q: 'Puis-je annuler à tout moment ?', a: 'Oui, sans engagement. Vous pouvez changer de plan ou annuler quand vous le souhaitez.' },
            ].map((item, i) => (
              <details key={i} className="glass-card p-5 group animate-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <summary className="font-semibold text-[#0a0a0c] cursor-pointer flex items-center justify-between list-none">
                  {item.q}
                  <span className="text-[#e11d2a] transition-transform group-open:rotate-45 text-xl">+</span>
                </summary>
                <p className="text-sm text-gray-600 mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ===== CTA final ===== */}
        <section className="px-4 sm:px-6 lg:px-12 py-16 max-w-7xl mx-auto">
          <div
            className="rounded-3xl p-10 md:p-14 text-center text-white relative overflow-hidden animate-scale-in"
            style={{ background: 'linear-gradient(135deg,#1a1a1f,#0a0a0c)' }}
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-30"
              style={{ background: 'radial-gradient(circle,#e11d2a,transparent 70%)' }} />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg,#e11d2a,#b3121d)' }}>
                <Zap size={26} fill="white" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Prêt à propulser votre business ?</h2>
              <p className="text-gray-300 mb-7 max-w-xl mx-auto">
                Créez votre compte gratuitement et envoyez votre premier devis en quelques minutes.
              </p>
              <Link to="/register" className="btn-primary">
                Créer mon compte gratuit <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>

        {/* ===== Footer ===== */}
        <footer className="px-4 sm:px-6 lg:px-12 py-10 max-w-7xl mx-auto">
          <div className="glass rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                style={{ background: 'linear-gradient(135deg,#e11d2a,#b3121d)' }}>
                <Zap size={16} fill="white" />
              </div>
              <span className="font-bold text-[#0a0a0c]">FactuFlow</span>
            </div>
            <p className="text-xs text-gray-500">© {new Date().getFullYear()} FactuFlow. Conçu pour les entrepreneurs africains.</p>
            <div className="flex gap-5 text-xs text-gray-500">
              <a href="#" className="hover:text-[#e11d2a]">Confidentialité</a>
              <a href="#" className="hover:text-[#e11d2a]">CGU</a>
              <a href="#" className="hover:text-[#e11d2a]">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
