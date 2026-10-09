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
              <div className="affiliate-eyebrow"><Gift size={15} /> Programme affilié</div>
              <p className="text-sm text-[#d9524d] font-bold mt-5">
                {data?.nom ? `${data.nom} vous invite sur Oryxa` : 'Rejoignez le programme partenaire Oryxa'}
              </p>
              <h1 className="affiliate-public-title">Faites découvrir Oryxa. Recevez une commission quand vos recommandations deviennent clientes.</h1>
              <p className="affiliate-public-lead">
                Vous connaissez des indépendants ou des petites entreprises qui jonglent avec leurs devis et leurs factures ? Partagez Oryxa avec eux. Vous pouvez participer même si vous n’utilisez pas encore l’application.
              </p>

              <div className="affiliate-benefits-grid">
                <div className="affiliate-soft-card">
                  <Sparkles size={19} />
                  <strong>{data?.rules?.discountPercent ?? 30}%</strong>
                  <p>de réduction pour un nouveau client pendant les premiers mois éligibles.</p>
                </div>
                <div className="affiliate-soft-card">
                  <WalletCards size={19} />
                  <strong>{fmt(data?.rules?.commissionPro ?? 250)}</strong>
                  <p>commission prévue pour un abonnement Pro éligible.</p>
                </div>
                <div className="affiliate-soft-card">
                  <WalletCards size={19} />
                  <strong>{fmt(data?.rules?.commissionBusiness ?? 400)}</strong>
                  <p>commission prévue pour un abonnement Business éligible.</p>
                </div>
              </div>

              <Link to={`/register?affiliate=1&ref=${encodeURIComponent(code || '')}`} className="btn-primary w-full justify-center mt-8 affiliate-main-action">
                Devenir affilié <ArrowRight size={18} />
              </Link>
              <Link to={`/login?from=affiliate${code ? `&ref=${encodeURIComponent(code)}` : ''}`} className="block text-center text-sm text-gray-500 mt-4 hover:text-[#d9524d]">
                J’ai déjà un compte Oryxa
              </Link>
            </>
          )}
        </div>
        <p className="text-center text-xs text-gray-400 mt-5">Un compte peut être client Oryxa, affilié, ou les deux.</p>
      </div>
    </div>
  );
}

const shareMessage = (link: string) =>
  `Salut ! Je te partage Oryxa, un outil pour préparer tes devis et factures et suivre les paiements au même endroit. Tu peux regarder tranquillement si ça peut te faire gagner du temps : ${link}`;

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
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage(link))}`;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia?.('(max-width: 768px)').matches;
    if (mobile) { window.location.href = url; return; }
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = url;
  };

  if (!user) return <PublicAffiliate code={ref} />;

  if (mode === 'public') return (
    <div className="affiliate-page affiliate-authenticated">
      <div className="affiliate-activation-wrap">
        <div className="affiliate-page-heading">
          <div className="affiliate-icon-large"><Gift size={24} /></div>
          <div>
            <p className="affiliate-eyebrow">Programme partenaire</p>
            <h1>Devenez affilié Oryxa</h1>
            <p>Vous connaissez des personnes à qui Oryxa pourrait simplifier la gestion des devis et des factures ? Activez votre espace affilié avec ce compte, sans en créer un deuxième.</p>
          </div>
        </div>

        <div className="affiliate-info-grid">
          <div className="affiliate-soft-card">
            <ShieldCheck size={20} />
            <p className="font-bold mt-3">Un seul compte</p>
            <p>Vous pouvez être client, affilié, ou les deux. Votre identité reste rattachée au même compte.</p>
          </div>
          <div className="affiliate-soft-card">
            <WalletCards size={20} />
            <p className="font-bold mt-3">Des commissions liées aux vrais paiements</p>
            <p>Une commission est créée après un abonnement éligible réellement payé.</p>
          </div>
        </div>

        {!me?.eligible && <div className="affiliate-alert affiliate-alert-warning">Confirmez d’abord votre adresse email pour participer au programme.</div>}
        {error && <div className="affiliate-alert affiliate-alert-error">{error}</div>}

        <div className="glass-card affiliate-activation-card">
          <div>
            <p className="font-bold">Vos coordonnées</p>
            <p className="text-sm text-gray-500 mt-1">Le numéro sert à identifier votre compte. La confirmation d’éligibilité reste liée à la vérification email existante d’Oryxa.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            <label className="affiliate-field-wrap"><span>Téléphone</span><input className="field" placeholder="+229 01 XX XX XX XX" value={phone} onChange={e => setPhone(e.target.value)} /></label>
            <label className="affiliate-field-wrap"><span>WhatsApp <em>de préférence</em></span><input className="field" placeholder="+229 01 XX XX XX XX" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} /></label>
          </div>
          <button disabled={loading || !me?.eligible} onClick={activate} className="btn-primary mt-5 w-full justify-center affiliate-main-action">
            {loading ? 'Activation…' : 'Activer mon espace affilié'} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="affiliate-page affiliate-authenticated">
      <div className="affiliate-dashboard">
        <div className="affiliate-dashboard-header">
          <div>
            <div className="affiliate-eyebrow"><Gift size={15} /> Programme partenaire</div>
            <h1>Mon affiliation</h1>
            <p>Retrouvez votre lien, les personnes inscrites grâce à vous et les commissions générées.</p>
          </div>
          <div className="affiliate-status-pill"><CheckCircle2 size={15} /> Affilié actif</div>
        </div>

        <div className="affiliate-link-card">
          <div className="affiliate-link-icon"><Link2 size={21} /></div>
          <div className="affiliate-link-content">
            <span>Votre lien personnel</span>
            <strong>{link || 'Chargement…'}</strong>
            <small>Partagez ce lien pour attribuer automatiquement vos recommandations.</small>
          </div>
          <div className="affiliate-link-actions">
            <button className="btn-soft" onClick={() => copy(link, 'link')} disabled={!link}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Copié' : 'Copier'}</button>
            <button className="btn-primary" onClick={shareWhatsApp} disabled={!link}><Share2 size={17} /> WhatsApp</button>
          </div>
        </div>

        <div className="affiliate-stats-grid">
          {[
            [MousePointerClick, 'Clics', stats?.clicks || 0],
            [Users, 'Inscriptions', stats?.signups || 0],
            [CheckCircle2, 'Clients payants', stats?.paidReferrals || 0],
            [WalletCards, 'Commissions', fmt(stats?.totalCommission || totalCommissions)],
            [WalletCards, 'Solde retirable', fmt(stats?.walletBalance || data?.walletBalance || 0)],
          ].map(([Icon, label, value]: any) => (
            <div className="affiliate-stat-card" key={label}>
              <div className="affiliate-stat-icon"><Icon size={17} /></div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div className="affiliate-content-grid">
          <section className="glass-card affiliate-panel">
            <div className="affiliate-panel-heading">
              <div><div className="affiliate-panel-icon"><BarChart3 size={18} /></div><div><h2>Votre activité</h2><p>Les indicateurs de votre acquisition.</p></div></div>
            </div>
            <div className="affiliate-mini-grid">
              <div><span>Taux de conversion visible</span><strong>{stats?.clicks ? `${((Number(stats?.paidReferrals || 0) / Number(stats.clicks)) * 100).toFixed(1)}%` : '0%'}</strong></div>
              <div><span>Filleuls actifs</span><strong>{referrals.filter((r: any) => ['active', 'converted'].includes(r.status)).length}</strong></div>
            </div>
            <div className="affiliate-share-box">
              <div><Sparkles size={17} /><div><strong>Un message prêt à partager</strong><p>{shareMessage(link || 'votre lien Oryxa')}</p></div></div>
              <button className="btn-soft" onClick={() => copy(shareMessage(link), 'message')} disabled={!link}>{shared ? <Check size={16} /> : <Clipboard size={16} />}{shared ? 'Copié' : 'Copier'}</button>
            </div>
          </section>

          <section className="glass-card affiliate-panel">
            <div className="affiliate-panel-heading"><div><div className="affiliate-panel-icon"><Gift size={18} /></div><div><h2>Votre avantage</h2><p>Les règles actuelles du programme.</p></div></div></div>
            <div className="affiliate-rules">
              <div><span>Réduction filleul</span><strong>{me?.rules?.discountPercent ?? 30}%</strong></div>
              <div><span>Durée</span><strong>{me?.rules?.discountMonths ?? 3} mois</strong></div>
              <div><span>Commission Pro</span><strong>{fmt(me?.rules?.commissionPro ?? 250)}</strong></div>
              <div><span>Commission Business</span><strong>{fmt(me?.rules?.commissionBusiness ?? 400)}</strong></div>
            </div>
          </section>
        </div>

        <section className="affiliate-how-card">
          <div><span className="affiliate-section-kicker">Comment ça fonctionne</span><h2>Un lien, des recommandations, des résultats.</h2><p>Partagez votre lien Oryxa. Une personne peut créer son compte, confirmer son email puis utiliser Oryxa. Lorsqu’un abonnement éligible est réellement payé, la relation est comptabilisée et la commission apparaît dans votre espace.</p></div>
          <div className="affiliate-how-steps"><div><b>1</b><span>Partagez votre lien</span></div><div><b>2</b><span>Votre filleul s’inscrit</span></div><div><b>3</b><span>Email confirmé</span></div><div><b>4</b><span>Abonnement payé</span></div></div>
        </section>

        <section className="glass-card affiliate-panel affiliate-table-panel">
          <div className="affiliate-panel-heading"><div><div className="affiliate-panel-icon"><Users size={18} /></div><div><h2>Mes filleuls</h2><p>Suivez les personnes apportées par votre lien.</p></div></div></div>
          <div className="affiliate-table-scroll">
            <table className="affiliate-table"><thead><tr><th>Utilisateur</th><th>Plan</th><th>Statut</th><th>Commission</th></tr></thead><tbody>
              {referrals.map((r: any) => <tr key={r._id}><td><strong>{r.referredUser?.nom || r.referredUser?.email || '—'}</strong><small>{r.referredUser?.email || ''}</small></td><td>{r.referredUser?.subscription || r.referredUser?.abonnement || 'gratuit'}</td><td><span className={`affiliate-status affiliate-status-${String(r.status || '').replace('_', '-')}`}>{r.status}</span></td><td className="font-bold">{fmt(r.totalCommission)}</td></tr>)}
              {!referrals.length && <tr><td colSpan={4} className="affiliate-empty">Aucun filleul pour le moment. Votre premier lien partagé apparaîtra ici.</td></tr>}
            </tbody></table>
          </div>
        </section>

        <section className="glass-card affiliate-panel affiliate-table-panel">
          <div className="affiliate-panel-heading"><div><div className="affiliate-panel-icon"><WalletCards size={18} /></div><div><h2>Historique des commissions</h2><p>Une vue claire des commissions enregistrées.</p></div></div></div>
          <div className="affiliate-table-scroll"><table className="affiliate-table"><thead><tr><th>Date</th><th>Plan</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
            {commissions.map((c: any) => <tr key={c._id}><td>{new Date(c.date || c.createdAt).toLocaleDateString('fr-FR')}</td><td className="capitalize">{c.plan}</td><td className="font-bold">{fmt(c.montant)}</td><td><span className="affiliate-status affiliate-status-paid">{c.statut}</span></td></tr>)}
            {!commissions.length && <tr><td colSpan={4} className="affiliate-empty">Aucune commission pour le moment.</td></tr>}
          </tbody></table></div>
        </section>

        {dashboardLoading && <div className="affiliate-refreshing"><span className="affiliate-spinner" /> Mise à jour de votre espace…</div>}
      </div>
    </div>
  );
}
