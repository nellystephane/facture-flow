import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, Check, CheckCircle2, Clipboard,
  Copy, Gift, Link2, MousePointerClick, ShieldCheck, Share2,
  Sparkles, Users, WalletCards
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { activateAffiliate, getAffiliateDashboard, getAffiliateMe, getPublicAffiliate } from '../api/affiliate';
import { apiError } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import OryxaLogo from '../components/OryxaLogo';
import ThemeToggle from '../components/ThemeToggle';
import CountUp from '../components/ui/CountUp';
import ChartButton from '../components/charts/ChartButton';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0)) + ' FCFA';

function PublicAffiliate({ code }: { code?: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    getPublicAffiliate(code)
      .then(r => setData(r.data))
      .catch(e => setError(apiError(e, 'Code affilié introuvable.')));
  }, [code]);

  return (
    <div className="app-bg min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div className="relative z-10 w-full max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <OryxaLogo size={40} nameClassName="font-extrabold text-lg text-gray-900 dark:text-white" imageClassName="rounded-xl shadow-md" />
          <ThemeToggle />
        </div>
        <div className="glass-card affiliate-public-card p-6 sm:p-9 md:p-11">
          {error ? (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-600">{error}</div>
          ) : (
            <>
              <div className="affiliate-eyebrow fx-pop"><Gift size={15} /> Parrainage Oryxa</div>
              <p className="text-sm text-[#d9524d] font-bold mt-5">
                {data?.nom ? `${data.nom} utilise Oryxa et vous le recommande.` : 'Parler d’Oryxa peut vous rapporter.'}
              </p>
              <h1 className="affiliate-public-title">Vous connaissez quelqu’un qui facture ? Faites-lui gagner du temps, et gagnez avec lui.</h1>
              <p className="affiliate-public-lead">
                Partagez votre lien à un freelance, un commerçant ou une petite entreprise. Quand il prend un abonnement et qu’il le paie, une commission est ajoutée à votre solde. Vous n’avez pas besoin d’être client Oryxa pour participer.
              </p>

              <div className="affiliate-benefits-grid fx-stagger">
                <div className="affiliate-soft-card">
                  <Sparkles size={19} />
                  <strong>−{data?.rules?.discountPercent ?? 30} %</strong>
                  <p>pour la personne que vous parrainez, sur ses {data?.rules?.discountMonths ?? 3} premiers mois d’abonnement.</p>
                </div>
                <div className="affiliate-soft-card">
                  <WalletCards size={19} />
                  <strong>{fmt(data?.rules?.commissionPro ?? 250)}</strong>
                  <p>pour vous, à chaque abonnement Pro payé par votre filleul.</p>
                </div>
                <div className="affiliate-soft-card">
                  <WalletCards size={19} />
                  <strong>{fmt(data?.rules?.commissionBusiness ?? 400)}</strong>
                  <p>pour vous, à chaque abonnement Business payé par votre filleul.</p>
                </div>
              </div>

              <Link to={`/register?affiliate=1&ref=${encodeURIComponent(code || '')}`} className="btn-primary w-full justify-center mt-8 affiliate-main-action">
                Je veux parrainer <ArrowRight size={18} />
              </Link>
              <Link to={`/login?from=affiliate${code ? `&ref=${encodeURIComponent(code)}` : ''}`} className="block text-center text-sm text-gray-500 mt-4 hover:text-[#d9524d]">
                J’ai déjà un compte Oryxa
              </Link>
            </>
          )}
        </div>
        <p className="text-center text-xs text-gray-400 mt-5">Un seul compte suffit : vous pouvez utiliser Oryxa et parrainer en même temps.</p>
      </div>
    </div>
  );
}

const shareMessage = (link: string) =>
  `Je fais mes devis, mes factures et mes encaissements sur Oryxa, et mes clients paient directement depuis leur téléphone. Si tu factures toi aussi, regarde ça : ${link}`;

export default function Affiliation() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const ref = params.get('ref') || '';
  const [mode, setMode] = useState<'public' | 'dashboard'>('public');
  const [data, setData] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [phone, setPhone] = useState(user?.telephone || '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (ref) localStorage.setItem('oryxa_affiliate_ref', ref.toUpperCase());
  }, [ref]);

  useEffect(() => {
    if (!user) return;
    getAffiliateMe().then(r => {
      setMe(r.data);
      if (r.data.active) setMode('dashboard');
    }).catch(e => setError(apiError(e, 'Impossible de charger votre espace affilié. Vérifiez votre connexion puis réessayez.')));
  }, [user]);

  const loadDashboard = async () => {
    setDashboardLoading(true);
    try {
      const r = await getAffiliateDashboard();
      setData(r.data);
      setError('');
      setMode('dashboard');
    } catch (e) {
      setError(apiError(e, 'Impossible de charger le tableau de bord affilié.'));
      throw e;
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'dashboard' && user && me?.active) loadDashboard().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user, me?.active]);

  const activate = async () => {
    setLoading(true); setError('');
    try {
      const r = await activateAffiliate({ telephone: phone.trim(), whatsapp: whatsapp.trim() });
      setMe(r.data.affiliate ? { active: true, eligible: true, affiliate: r.data.affiliate, rules: r.data.affiliate.rules } : r.data);
      setMode('dashboard');
      await loadDashboard();
    } catch (e) {
      setError(apiError(e, 'Impossible d’activer l’affiliation.'));
    } finally {
      setLoading(false);
    }
  };

  const link = data?.affiliate?.link || me?.affiliate?.link || '';
  const referrals = data?.referrals || [];
  const commissions = data?.commissions || [];
  const stats = data?.affiliate || me?.affiliate;
  const totalCommissions = useMemo(
    () => commissions.reduce((s: number, c: any) => s + Number(c.montant || 0), 0),
    [commissions]
  );

  const copy = async (value: string, kind: 'link' | 'message') => {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    if (kind === 'link') {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    }
  };

  const shareWhatsApp = () => {
    if (!link) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage(link))}`, '_blank', 'noopener,noreferrer');
  };

  if (!user) return <PublicAffiliate code={ref} />;

  if (mode === 'public') return (
    <div className="affiliate-page">
      <div className="affiliate-topbar"><OryxaLogo size={38} nameClassName="font-extrabold text-lg text-gray-900 dark:text-white" imageClassName="rounded-xl" /><ThemeToggle /></div>
      <div className="affiliate-activation-wrap">
        <div className="affiliate-page-heading">
          <div className="affiliate-icon-large"><Gift size={24} /></div>
          <div>
            <p className="affiliate-eyebrow">Parrainage</p>
            <h1>Recommandez Oryxa, soyez payé pour ça</h1>
            <p>Votre compte actuel suffit : en l’activant, vous obtenez votre lien personnel et le suivi de vos commissions.</p>
          </div>
        </div>

        <div className="affiliate-info-grid">
          <div className="affiliate-soft-card">
            <ShieldCheck size={20} />
            <p className="font-bold mt-3">Pas de deuxième compte</p>
            <p>Vous gardez les mêmes identifiants. Vos factures et vos parrainages restent séparés.</p>
          </div>
          <div className="affiliate-soft-card">
            <WalletCards size={20} />
            <p className="font-bold mt-3">Payé uniquement sur de vrais paiements</p>
            <p>Une commission apparaît quand un abonnement est effectivement payé, jamais sur une simple inscription. Elle rejoint votre solde retirable.</p>
          </div>
        </div>

        {!me?.eligible && <div className="affiliate-alert affiliate-alert-warning">Confirmez d’abord votre adresse e-mail (lien reçu à l’inscription) pour activer le parrainage.</div>}
        {error && <div className="affiliate-alert affiliate-alert-error">{error}</div>}

        <div className="glass-card affiliate-activation-card">
          <div>
            <p className="font-bold">Comment peut-on vous joindre ?</p>
            <p className="text-sm text-gray-500 mt-1">Nous utilisons ce numéro uniquement pour vous contacter au sujet de vos commissions.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            <label className="affiliate-field-wrap"><span>Téléphone</span><input className="field" placeholder="+229…" value={phone} onChange={e => setPhone(e.target.value)} /></label>
            <label className="affiliate-field-wrap"><span>WhatsApp <em>de préférence</em></span><input className="field" placeholder="+229…" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} /></label>
          </div>
          <button disabled={loading || !me?.eligible} onClick={activate} className="btn-primary mt-5 w-full justify-center affiliate-main-action">
            {loading ? 'Activation…' : 'Obtenir mon lien de parrainage'} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="affiliate-page">
      <div className="affiliate-topbar"><OryxaLogo size={38} nameClassName="font-extrabold text-lg text-gray-900 dark:text-white" imageClassName="rounded-xl" /><ThemeToggle /></div>
      <div className="affiliate-dashboard">
        <div className="affiliate-dashboard-header">
          <div>
            <div className="affiliate-eyebrow"><Gift size={15} /> Parrainage</div>
            <h1>Mon parrainage</h1>
            <p>Combien de personnes ont ouvert votre lien, qui s’est inscrit, et ce que vous avez gagné.</p>
          </div>
          <div className="flex items-center gap-2">
            <ChartButton metrics={['commissions_affiliation', 'nouveaux_filleuls']} title="Analyser mon parrainage" label="Graphiques" period="12m" />
            <div className="affiliate-status-pill"><CheckCircle2 size={15} /> Actif</div>
          </div>
        </div>

        <div className="affiliate-link-card">
          <div className="affiliate-link-icon"><Link2 size={21} /></div>
          <div className="affiliate-link-content">
            <span>Votre lien</span>
            <strong>{link || 'Chargement…'}</strong>
            <small>Toute personne qui s’inscrit depuis ce lien vous est automatiquement attribuée.</small>
          </div>
          <div className="affiliate-link-actions">
            <button className="btn-soft" onClick={() => copy(link, 'link')} disabled={!link}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Copié' : 'Copier'}</button>
            <button className="btn-primary" onClick={shareWhatsApp} disabled={!link}><Share2 size={17} /> WhatsApp</button>
          </div>
        </div>

        <div className="affiliate-stats-grid fx-stagger">
          {[
            [MousePointerClick, 'Visites du lien', String(stats?.clicks || 0)],
            [Users, 'Inscrits', String(stats?.signups || 0)],
            [CheckCircle2, 'Abonnés', String(stats?.paidReferrals || 0)],
            [WalletCards, 'Gagné au total', fmt(stats?.totalCommission || totalCommissions)],
            [WalletCards, 'Disponible', fmt(stats?.walletBalance || data?.walletBalance || 0)],
          ].map(([Icon, label, value]: any) => (
            <div className="affiliate-stat-card" key={label}>
              <div className="affiliate-stat-icon"><Icon size={17} /></div>
              <span>{label}</span>
              <strong><CountUp value={value} /></strong>
            </div>
          ))}
        </div>

        <div className="affiliate-content-grid">
          <section className="glass-card affiliate-panel">
            <div className="affiliate-panel-heading">
              <div><div className="affiliate-panel-icon"><BarChart3 size={18} /></div><div><h2>Où en est votre lien</h2><p>De la visite à l’abonnement.</p></div></div>
            </div>
            <div className="affiliate-mini-grid">
              <div><span>Visiteurs devenus abonnés</span><strong>{stats?.clicks ? `${((Number(stats?.paidReferrals || 0) / Number(stats.clicks)) * 100).toFixed(1)}%` : '0%'}</strong></div>
              <div><span>Inscrits en cours</span><strong>{referrals.filter((r: any) => ['active', 'converted'].includes(r.status)).length}</strong></div>
            </div>
            <div className="affiliate-share-box">
              <div><Sparkles size={17} /><div><strong>Un message tout prêt</strong><p>{shareMessage(link || 'votre lien Oryxa')}</p></div></div>
              <button className="btn-soft" onClick={() => copy(shareMessage(link), 'message')} disabled={!link}>{shared ? <Check size={16} /> : <Clipboard size={16} />}{shared ? 'Copié' : 'Copier'}</button>
            </div>
          </section>

          <section className="glass-card affiliate-panel">
            <div className="affiliate-panel-heading"><div><div className="affiliate-panel-icon"><Gift size={18} /></div><div><h2>Ce que ça rapporte</h2><p>Les conditions en vigueur.</p></div></div></div>
            <div className="affiliate-rules">
              <div><span>Réduction pour votre filleul</span><strong>{me?.rules?.discountPercent ?? 30}%</strong></div>
              <div><span>Pendant</span><strong>{me?.rules?.discountMonths ?? 3} mois</strong></div>
              <div><span>Vous touchez (abonnement Pro)</span><strong>{fmt(me?.rules?.commissionPro ?? 250)}</strong></div>
              <div><span>Vous touchez (abonnement Business)</span><strong>{fmt(me?.rules?.commissionBusiness ?? 400)}</strong></div>
            </div>
          </section>
        </div>

        <section className="affiliate-how-card">
          <div><span className="affiliate-section-kicker">En pratique</span><h2>Vous partagez. Il s’abonne. Vous êtes crédité.</h2><p>La commission est ajoutée à votre solde dès que l’abonnement de votre filleul est payé. Ce solde se retire comme n’importe quel encaissement Oryxa, depuis la page Paiements.</p></div>
          <div className="affiliate-how-steps"><div><b>1</b><span>Vous envoyez votre lien</span></div><div><b>2</b><span>Il crée son compte</span></div><div><b>3</b><span>Il confirme son e-mail</span></div><div><b>4</b><span>Il paie, vous touchez</span></div></div>
        </section>

        <section className="glass-card affiliate-panel affiliate-table-panel">
          <div className="affiliate-panel-heading"><div><div className="affiliate-panel-icon"><Users size={18} /></div><div><h2>Mes filleuls</h2><p>Les personnes arrivées par votre lien.</p></div></div></div>
          <div className="affiliate-table-scroll">
            <table className="affiliate-table"><thead><tr><th>Filleul</th><th>Abonnement</th><th>Statut</th><th>Vous a rapporté</th></tr></thead><tbody>
              {referrals.map((r: any) => <tr key={r._id}><td><strong>{r.referredUser?.nom || r.referredUser?.email || '—'}</strong><small>{r.referredUser?.email || ''}</small></td><td>{r.referredUser?.subscription || r.referredUser?.abonnement || 'gratuit'}</td><td><span className={`affiliate-status affiliate-status-${String(r.status || '').replace('_', '-')}`}>{r.status}</span></td><td className="font-bold">{fmt(r.totalCommission)}</td></tr>)}
              {!referrals.length && <tr><td colSpan={4} className="affiliate-empty">Personne pour l’instant. Envoyez votre lien à une première personne, elle apparaîtra ici dès son inscription.</td></tr>}
            </tbody></table>
          </div>
        </section>

        <section className="glass-card affiliate-panel affiliate-table-panel">
          <div className="affiliate-panel-heading"><div><div className="affiliate-panel-icon"><WalletCards size={18} /></div><div><h2>Mes commissions</h2><p>Chaque abonnement payé par un filleul.</p></div></div></div>
          <div className="affiliate-table-scroll"><table className="affiliate-table"><thead><tr><th>Date</th><th>Abonnement</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
            {commissions.map((c: any) => <tr key={c._id}><td>{new Date(c.date || c.createdAt).toLocaleDateString('fr-FR')}</td><td className="capitalize">{c.plan}</td><td className="font-bold">{fmt(c.montant)}</td><td><span className="affiliate-status affiliate-status-paid">{c.statut}</span></td></tr>)}
            {!commissions.length && <tr><td colSpan={4} className="affiliate-empty">Aucune commission pour l’instant : elle arrive quand un filleul paie son premier abonnement.</td></tr>}
          </tbody></table></div>
        </section>

        {dashboardLoading && <div className="affiliate-refreshing"><span className="affiliate-spinner" /> Actualisation…</div>}
      </div>
    </div>
  );
}
