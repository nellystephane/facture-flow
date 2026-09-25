import { useEffect, useState, type ReactNode } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, Tag, FileText, LogOut, ArrowDownUp, Headphones, Menu, X, WalletCards, ReceiptText, Settings2, CircleDollarSign, ShieldCheck, ChevronRight, Gift, MousePointerClick, Check,
} from 'lucide-react';
import adminApi from '../../api/adminAxios';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import OryxaLogo from '../../components/OryxaLogo';
import Select from '../../components/ui/Select';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

// ==================== Coquille (nav + mise en page) ====================

function AdminShell({ children }: { children: ReactNode }) {
  const { adminEmail, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections = [
    { titre: 'Pilotage', liens: [
      { to: '/admin', label: "Vue d'ensemble", icon: LayoutDashboard, end: true },
      { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
    ] },
    { titre: 'Finances', liens: [
      { to: '/admin/paiements', label: 'Paiements clients', icon: CreditCard },
      { to: '/admin/finance', label: 'Finance & reversements', icon: ArrowDownUp },
      { to: '/admin/tarifs', label: 'Abonnements & tarifs', icon: CircleDollarSign },
    ] },
    { titre: 'Plateforme', liens: [
      { to: '/admin/support', label: 'Support client', icon: Headphones },
      { to: '/admin/affiliation', label: 'Affiliation', icon: Gift },
      { to: '/admin/legal', label: 'Contenu légal', icon: FileText },
    ] },
  ];

  const seDeconnecter = () => {
    logout();
    navigate('/admin/login');
  };

  const fermerMobile = () => setMobileOpen(false);

  return (
    <div className="dark">
      <div className="app-bg !min-h-screen">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={fermerMobile} />
        )}

        <aside className={`fixed top-0 left-0 z-50 h-screen w-[286px] p-4 transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="glass-card h-full p-5 flex flex-col !bg-[rgba(26,26,31,0.78)] !border-white/10">
            <div className="flex items-center justify-between mb-7">
              <OryxaLogo size={40} nameClassName="font-extrabold text-lg text-white leading-none" imageClassName="rounded-xl shadow-lg" />
              <button className="btn-icon lg:hidden" onClick={fermerMobile} aria-label="Fermer le menu"><X size={18} /></button>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg,#d9524d,#b23c37)' }}><ShieldCheck size={18} /></div>
                <div className="min-w-0"><p className="text-xs text-gray-400">Espace sécurisé</p><p className="text-sm font-semibold text-white truncate">Administration Oryxa</p></div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto space-y-5 pr-1">
              {sections.map((section) => (
                <div key={section.titre}>
                  <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">{section.titre}</p>
                  <div className="space-y-1">
                    {section.liens.map(({ to, label, icon: Icon, end }) => (
                      <NavLink key={to} to={to} end={end} onClick={fermerMobile} className={({ isActive }) => `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-soft ${isActive ? 'text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} style={({ isActive }) => isActive ? { background: 'linear-gradient(135deg,#d9524d,#b23c37)' } : undefined}>
                        <Icon size={17} />
                        <span className="flex-1">{label}</span>
                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-50" />
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: 'linear-gradient(135deg,#d9524d,#b23c37)' }}>A</div>
                <div className="min-w-0"><p className="text-sm font-semibold text-white">Administrateur</p><p className="text-xs text-gray-500 truncate">{adminEmail}</p></div>
              </div>
              <button onClick={seDeconnecter} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-[#f4847d] bg-[#d9524d]/10 hover:bg-[#d9524d]/20 transition-soft"><LogOut size={16} /> Déconnexion</button>
            </div>
          </div>
        </aside>

        <div className="lg:ml-[286px] min-h-screen flex flex-col">
          <header className="lg:hidden sticky top-0 z-30 glass px-4 py-3 flex items-center justify-between">
            <button className="btn-icon" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu"><Menu size={20} /></button>
            <OryxaLogo size={30} nameClassName="font-bold text-lg text-white" imageClassName="rounded-lg" />
            <button className="btn-icon" onClick={seDeconnecter} aria-label="Déconnexion"><LogOut size={17} /></button>
          </header>

          <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

// ==================== Vue d'ensemble ====================

interface Stats {
  totalUsers: number;
  abonnesParPlan: { gratuit: number; pro: number; business: number };
  revenuBrut: number;
  revenuAbonnements: number;
  abonnementsPayesCount: number;
  revenuAbonnementsNetEstime: number;
  paiementsUtilisateursEnLigne: number;
  fraisEstimes: number;
  revenuReelEstime: number;
  fedapayFeePercent: number;
  croissanceMensuelle: { mois: string; nouveauxComptes: number }[];
}

function VueEnsemble() {
  const { adminEmail } = useAdminAuth();
  const [emailTest, setEmailTest] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [chargement, setChargement] = useState(true);
  const [support, setSupport] = useState<{ nonLus: number; tickets: any[] }>({ nonLus: 0, tickets: [] });

  useEffect(() => {
    Promise.all([adminApi.get('/admin/stats'), adminApi.get('/admin/support', { params: { limite: 5 } })])
      .then(([statsRes, supportRes]) => { setStats(statsRes.data); setSupport({ nonLus: supportRes.data.nonLus, tickets: supportRes.data.tickets }); })
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <div className="flex justify-center py-20"><div className="spinner" /></div>;
  if (!stats) return null;

  const maxCroissance = Math.max(1, ...stats.croissanceMensuelle.map((c) => c.nouveauxComptes));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs text-gray-400 mb-1.5">Comptes totaux</p>
          <p className="text-2xl font-extrabold text-white">{stats.totalUsers}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-gray-400 mb-1.5">Abonnés Pro</p>
          <p className="text-2xl font-extrabold text-white">{stats.abonnesParPlan.pro}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-gray-400 mb-1.5">Abonnés Business</p>
          <p className="text-2xl font-extrabold text-white">{stats.abonnesParPlan.business}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-gray-400 mb-1.5">Comptes Gratuit</p>
          <p className="text-2xl font-extrabold text-white">{stats.abonnesParPlan.gratuit}</p>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div><p className="text-sm font-bold text-white flex items-center gap-2"><CircleDollarSign size={17} className="text-[#f4847d]" /> Revenus réels générés par Oryxa</p><p className="text-xs text-gray-500 mt-1">Seuls les abonnements effectivement enregistrés comme payés sont comptés comme revenus de la plateforme.</p></div>
          <NavLink to="/admin/finance" className="text-xs font-semibold text-[#f4847d] hover:underline whitespace-nowrap">Détail financier →</NavLink>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><p className="text-xs text-gray-400">Abonnements encaissés</p><p className="text-xl font-extrabold text-white mt-1">{fmt(stats.revenuAbonnements)}</p><p className="text-[11px] text-gray-500 mt-1">{stats.abonnementsPayesCount} abonnement{stats.abonnementsPayesCount > 1 ? 's' : ''} payé{stats.abonnementsPayesCount > 1 ? 's' : ''}</p></div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><p className="text-xs text-gray-400">Net estimé après frais FedaPay</p><p className="text-xl font-extrabold text-emerald-300 mt-1">{fmt(stats.revenuAbonnementsNetEstime)}</p><p className="text-[11px] text-gray-500 mt-1">Estimation à {stats.fedapayFeePercent}% — pas un relevé FedaPay</p></div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><p className="text-xs text-gray-400">Flux clients des utilisateurs</p><p className="text-xl font-extrabold text-white mt-1">{fmt(stats.paiementsUtilisateursEnLigne)}</p><p className="text-[11px] text-gray-500 mt-1">Argent des utilisateurs, pas un revenu Oryxa</p></div>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between gap-3 mb-4"><div><p className="text-sm font-semibold text-white">Support client</p><p className="text-xs text-gray-500 mt-1">{support.nonLus} demande{support.nonLus > 1 ? 's' : ''} avec nouveau message</p></div><NavLink to="/admin/support" className="text-xs font-semibold text-[#f4847d] hover:underline">Ouvrir le support →</NavLink></div>
        {support.tickets.length === 0 ? <p className="text-sm text-gray-500">Aucune demande récente.</p> : <div className="space-y-2">{support.tickets.slice(0,5).map((t: any) => <NavLink key={t._id} to={`/admin/support`} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 hover:bg-white/10"><div className="min-w-0"><p className="text-sm text-gray-200 truncate">{t.sujet}</p><p className="text-[11px] text-gray-500 truncate">{t.owner?.nom} · {t.numero}</p></div><span className="text-[11px] text-gray-500">{supportStatus[t.statut] || t.statut}</span></NavLink>)}</div>}
      </div>

      <div className="glass-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Diagnostic email</p>
            <p className="text-xs text-gray-500 mt-1">Envoie un vrai email SMTP de test pour vérifier la configuration de production.</p>
          </div>
          <button
            className="btn-ghost shrink-0"
            disabled={testEmailLoading}
            onClick={async () => {
              setTestEmailLoading(true);
              setEmailTest('');
              try {
                const res = await adminApi.post('/admin/email-test', { to: adminEmail });
                setEmailTest(res.data.message || 'Email de test envoyé.');
              } catch (err: any) {
                setEmailTest(err?.response?.data?.message || 'Échec du test email.');
              } finally {
                setTestEmailLoading(false);
              }
            }}
          >
            {testEmailLoading ? 'Test en cours…' : 'Tester l’email'}
          </button>
        </div>
        {emailTest && <p className="text-xs text-gray-400 mt-3">{emailTest}</p>}
      </div>

      <div className="glass-card p-5">
        <p className="text-sm font-semibold text-white mb-4">Nouveaux comptes — 6 derniers mois</p>
        <div className="flex items-end gap-3 h-32">
          {stats.croissanceMensuelle.map((c) => (
            <div key={c.mois} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full rounded-t-lg transition-all"
                style={{
                  height: `${Math.max(6, (c.nouveauxComptes / maxCroissance) * 100)}%`,
                  background: 'linear-gradient(180deg,#d9524d,#b23c37)',
                }}
                title={`${c.nouveauxComptes} nouveaux comptes`}
              />
              <span className="text-[10px] text-gray-500">{c.mois.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== Utilisateurs ====================

interface AdminUser {
  _id: string; nom: string; email: string; entreprise?: string;
  subscription: 'gratuit' | 'pro' | 'business'; suspendu: boolean; suspensionMotif?: string;
  emailVerifie: boolean; createdAt: string;
}

function Utilisateurs() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);

  const charger = () => {
    setChargement(true);
    adminApi.get('/admin/users', { params: { recherche } }).then((res) => setUsers(res.data.users)).finally(() => setChargement(false));
  };

  useEffect(() => { charger(); }, []);

  const suspendre = async (u: AdminUser) => {
    const motif = window.prompt(`Motif de suspension pour ${u.email} (visible par l'utilisateur) :`, '');
    if (motif === null) return;
    await adminApi.patch(`/admin/users/${u._id}/suspendre`, { motif });
    charger();
  };

  const reactiver = async (u: AdminUser) => {
    await adminApi.patch(`/admin/users/${u._id}/reactiver`);
    charger();
  };

  const changerPlan = async (u: AdminUser, subscription: string) => {
    await adminApi.patch(`/admin/users/${u._id}/plan`, { subscription });
    charger();
  };

  return (
    <div className="glass-card p-5">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          className="field flex-1"
          placeholder="Rechercher (nom, email, entreprise)…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && charger()}
        />
        <button onClick={charger} className="btn-ghost">Rechercher</button>
      </div>

      {chargement ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-white/10">
                <th className="px-5 py-2 font-medium">Utilisateur</th>
                <th className="px-5 py-2 font-medium">Plan</th>
                <th className="px-5 py-2 font-medium">Statut</th>
                <th className="px-5 py-2 font-medium">Inscrit le</th>
                <th className="px-5 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-b border-white/5">
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{u.nom}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <Select value={u.subscription} onChange={(v) => changerPlan(u, v)} options={[{value:'gratuit',label:'Gratuit'},{value:'pro',label:'Pro'},{value:'business',label:'Business'}]} className="!py-1.5 !px-2 text-xs w-auto" />
                  </td>
                  <td className="px-5 py-3">
                    {u.suspendu ? (
                      <span className="badge badge-en_retard">Suspendu</span>
                    ) : (
                      <span className="badge badge-payee">Actif</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {u.suspendu ? (
                      <button onClick={() => reactiver(u)} className="btn-ghost !py-1.5 !px-3 text-xs">Réactiver</button>
                    ) : (
                      <button onClick={() => suspendre(u)} className="btn-ghost !py-1.5 !px-3 text-xs !text-[#f4847d]">Suspendre</button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-10">Aucun utilisateur trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== Paiements ====================

interface AdminPayment {
  _id: string; montant: number; statut: string; origine: string;
  litige: boolean; litigeNote?: string; rembourse: boolean; createdAt: string;
  owner?: { nom: string; email: string }; invoice?: { numero: string };
}

function Paiements() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [filtreLitige, setFiltreLitige] = useState(false);
  const [chargement, setChargement] = useState(true);

  const charger = () => {
    setChargement(true);
    adminApi.get('/admin/payments', { params: { litige: filtreLitige ? 'true' : '' } })
      .then((res) => setPayments(res.data.payments)).finally(() => setChargement(false));
  };

  useEffect(() => { charger(); }, [filtreLitige]);

  const signalerLitige = async (p: AdminPayment) => {
    const note = window.prompt('Note sur le litige :', p.litigeNote || '');
    if (note === null) return;
    await adminApi.patch(`/admin/payments/${p._id}/litige`, { note });
    charger();
  };

  const resoudreLitige = async (p: AdminPayment) => {
    await adminApi.patch(`/admin/payments/${p._id}/litige/resoudre`);
    charger();
  };

  const marquerRembourse = async (p: AdminPayment) => {
    if (!window.confirm('Marquer ce paiement comme remboursé ? (le remboursement réel se fait sur le tableau de bord FedaPay, ceci ne fait que le noter ici)')) return;
    await adminApi.patch(`/admin/payments/${p._id}/rembourse`);
    charger();
  };

  return (
    <div className="glass-card p-5">
      <label className="flex items-center gap-2 text-sm text-gray-300 mb-4 cursor-pointer w-fit">
        <input type="checkbox" checked={filtreLitige} onChange={(e) => setFiltreLitige(e.target.checked)} />
        Afficher uniquement les litiges
      </label>

      {chargement ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-white/10">
                <th className="px-5 py-2 font-medium">Client</th>
                <th className="px-5 py-2 font-medium">Facture</th>
                <th className="px-5 py-2 font-medium">Montant</th>
                <th className="px-5 py-2 font-medium">Statut</th>
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-5 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id} className="border-b border-white/5">
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{p.owner?.nom || '—'}</p>
                    <p className="text-xs text-gray-500">{p.owner?.email}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-300">{p.invoice?.numero || '—'}</td>
                  <td className="px-5 py-3 text-white font-medium">{fmt(p.montant)}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`badge ${p.statut === 'complete' ? 'badge-payee' : p.statut === 'echoue' ? 'badge-en_retard' : 'badge-envoyee'}`}>
                        {p.statut}
                      </span>
                      {p.litige && <span className="badge badge-en_retard">Litige</span>}
                      {p.rembourse && <span className="badge badge-brouillon">Remboursé</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {p.litige ? (
                      <button onClick={() => resoudreLitige(p)} className="btn-ghost !py-1.5 !px-3 text-xs">Résoudre litige</button>
                    ) : (
                      <button onClick={() => signalerLitige(p)} className="btn-ghost !py-1.5 !px-3 text-xs !text-[#f4847d]">Signaler litige</button>
                    )}
                    {!p.rembourse && p.statut === 'complete' && (
                      <button onClick={() => marquerRembourse(p)} className="btn-ghost !py-1.5 !px-3 text-xs ml-2">Rembourser</button>
                    )}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-500 py-10">Aucun paiement</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== Finance & reversements ====================

interface FinanceData {
  synthese: { encaisseEnLigne: number; montantFactures: number; fraisFacturesAuxClients: number; fraisPayinReels: number; fraisPayoutReels: number; margeTechnique: number; revenuAbonnements: number; revenuAbonnementsNetEstime: number };
  abonnements: any[];
  mouvements: { type: string; total: number; count: number }[];
  payouts: any[];
  paiements: any[];
}

function Finance() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [chargement, setChargement] = useState(true);
  const charger = () => {
    setChargement(true);
    adminApi.get('/admin/finance').then((res) => setData(res.data)).finally(() => setChargement(false));
  };
  useEffect(() => { charger(); }, []);

  if (chargement || !data) return <div className="flex justify-center py-20"><div className="spinner" /></div>;
  const s = data.synthese;
  const typeLabel: Record<string, string> = {
    credit_paiement: 'Crédits issus des paiements',
    debit_frais: 'Frais',
    credit_ajustement: 'Ajustements crédit',
    debit_reversement: 'Reversements débités',
    credit_annulation: 'Annulations créditées',
  };
  const payoutStatus: Record<string, string> = { pending: 'En attente', started: 'Démarré', processing: 'En cours', sent: 'Envoyé', failed: 'Échec' };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-extrabold text-white">Finance & reversements</h2>
        <p className="text-sm text-gray-500 mt-1">Vue réelle des frais, marges techniques et mouvements enregistrés dans Oryxa.</p>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-4 mb-4"><div><h3 className="font-bold text-white flex items-center gap-2"><CircleDollarSign size={17} className="text-[#f4847d]" /> Revenu propre à Oryxa</h3><p className="text-xs text-gray-500 mt-1">Ce flux correspond aux abonnements payés. Les montants des factures clients appartiennent aux utilisateurs et ne sont pas assimilés au chiffre d'affaires Oryxa.</p></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-[#d9524d]/10 border border-[#d9524d]/20 p-4"><p className="text-xs text-gray-400">Abonnements payés</p><p className="text-2xl font-extrabold text-white mt-1">{fmt(s.revenuAbonnements)}</p><p className="text-[11px] text-gray-500 mt-1">Montant brut réellement enregistré dans Oryxa</p></div>
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4"><p className="text-xs text-gray-400">Net estimé</p><p className="text-2xl font-extrabold text-emerald-300 mt-1">{fmt(s.revenuAbonnementsNetEstime)}</p><p className="text-[11px] text-gray-500 mt-1">Estimation après frais moyens FedaPay ; le coût réel doit être confirmé par FedaPay.</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5"><p className="text-xs text-gray-400">Encaissements en ligne</p><p className="text-xl font-extrabold text-white mt-1">{fmt(s.encaisseEnLigne)}</p></div>
        <div className="glass-card p-5"><p className="text-xs text-gray-400">Frais facturés aux clients</p><p className="text-xl font-extrabold text-white mt-1">{fmt(s.fraisFacturesAuxClients)}</p></div>
        <div className="glass-card p-5"><p className="text-xs text-gray-400">Frais Pay-in réels</p><p className="text-xl font-extrabold text-[#f4847d] mt-1">− {fmt(s.fraisPayinReels)}</p></div>
        <div className="glass-card p-5"><p className="text-xs text-gray-400">Frais payout réels</p><p className="text-xl font-extrabold text-[#f4847d] mt-1">− {fmt(s.fraisPayoutReels)}</p></div>
        <div className="glass-card p-5 lg:col-span-2"><p className="text-xs text-gray-400">Écart de frais / marge technique</p><p className={`text-2xl font-extrabold mt-1 ${s.margeTechnique >= 0 ? 'text-emerald-300' : 'text-[#f4847d]'}`}>{fmt(s.margeTechnique)}</p><p className="text-[11px] text-gray-500 mt-1">Frais facturés aux clients − frais FedaPay Pay-in − frais FedaPay payout. Ce n'est pas un bénéfice comptable officiel.</p></div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4"><div><h3 className="font-bold text-white">Mouvements des comptes Oryxa</h3><p className="text-xs text-gray-500">Ledger interne, sans prétendre représenter la balance FedaPay.</p></div><button onClick={charger} className="btn-ghost !py-1.5 !px-3 text-xs">Actualiser</button></div>
        <div className="space-y-2">
          {data.mouvements.map((m) => <div key={m.type} className="flex justify-between items-center border-b border-white/5 py-2"><span className="text-sm text-gray-300">{typeLabel[m.type] || m.type}</span><span className="text-sm font-semibold text-white">{fmt(m.total)} <span className="text-xs text-gray-500">({m.count})</span></span></div>)}
          {!data.mouvements.length && <p className="text-sm text-gray-500">Aucun mouvement.</p>}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4"><div><h3 className="font-bold text-white">Abonnements Oryxa encaissés</h3><p className="text-xs text-gray-500 mt-1">Historique des revenus propres de la plateforme.</p></div></div>
        <div className="overflow-x-auto -mx-5"><table className="w-full text-sm min-w-[760px]"><thead><tr className="text-left text-xs text-gray-500 border-b border-white/10"><th className="px-5 py-2">Utilisateur</th><th className="px-5 py-2">Plan</th><th className="px-5 py-2">Durée</th><th className="px-5 py-2">Montant encaissé</th><th className="px-5 py-2">Date</th></tr></thead><tbody>
          {data.abonnements.map((a) => <tr key={a._id} className="border-b border-white/5"><td className="px-5 py-3"><p className="font-medium text-white">{a.owner?.nom || '—'}</p><p className="text-xs text-gray-500">{a.owner?.email || ''}</p></td><td className="px-5 py-3 text-gray-300 capitalize">{a.plan}</td><td className="px-5 py-3 text-gray-300">{a.duree === '1mois' ? '1 mois' : a.duree === '6mois' ? '6 mois' : '1 an'}</td><td className="px-5 py-3 font-semibold text-white">{fmt(a.montant)}</td><td className="px-5 py-3 text-xs text-gray-500">{new Date(a.createdAt).toLocaleString('fr-FR')}</td></tr>)}
          {!data.abonnements.length && <tr><td colSpan={5} className="text-center text-gray-500 py-10">Aucun abonnement payé enregistré.</td></tr>}
        </tbody></table></div>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-bold text-white mb-4">Reversements FedaPay</h3>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm min-w-[900px]"><thead><tr className="text-left text-xs text-gray-500 border-b border-white/10"><th className="px-5 py-2">Utilisateur</th><th className="px-5 py-2">Montant</th><th className="px-5 py-2">Frais payout</th><th className="px-5 py-2">Débité</th><th className="px-5 py-2">Transféré</th><th className="px-5 py-2">Statut</th><th className="px-5 py-2">Date</th></tr></thead><tbody>
            {data.payouts.map((p) => <tr key={p._id} className="border-b border-white/5"><td className="px-5 py-3"><p className="font-medium text-white">{p.owner?.nom || '—'}</p><p className="text-xs text-gray-500">{p.destination?.provider || ''} {p.destination?.phone || ''}</p></td><td className="px-5 py-3 text-white">{fmt(p.montant)}</td><td className="px-5 py-3 text-[#f4847d]">{fmt(p.fraisFedaPay)}</td><td className="px-5 py-3">{fmt(p.montantDebite)}</td><td className="px-5 py-3">{fmt(p.montantTransfere)}</td><td className="px-5 py-3"><span className={`badge ${p.statut === 'sent' ? 'badge-payee' : p.statut === 'failed' ? 'badge-en_retard' : 'badge-envoyee'}`}>{payoutStatus[p.statut] || p.statut}</span></td><td className="px-5 py-3 text-xs text-gray-500">{new Date(p.createdAt).toLocaleString('fr-FR')}</td></tr>)}
            {!data.payouts.length && <tr><td colSpan={7} className="text-center text-gray-500 py-10">Aucun reversement.</td></tr>}
          </tbody></table>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-bold text-white mb-4">Mouvements de paiement</h3>
        <div className="overflow-x-auto -mx-5"><table className="w-full text-sm min-w-[900px]"><thead><tr className="text-left text-xs text-gray-500 border-b border-white/10"><th className="px-5 py-2">Utilisateur</th><th className="px-5 py-2">Facture</th><th className="px-5 py-2">Payé par client</th><th className="px-5 py-2">Frais Pay-in</th><th className="px-5 py-2">Supportés par</th><th className="px-5 py-2">Net utilisateur</th><th className="px-5 py-2">Date</th></tr></thead><tbody>
          {data.paiements.map((p) => <tr key={p._id} className="border-b border-white/5"><td className="px-5 py-3 text-white">{p.owner?.nom || '—'}</td><td className="px-5 py-3 text-gray-300">{p.invoice?.numero || '—'}</td><td className="px-5 py-3">{fmt(p.montantClientPaye ?? p.montant)}</td><td className="px-5 py-3 text-[#f4847d]">{fmt(p.fraisPayin)}</td><td className="px-5 py-3">{p.fraisSupportesPar === 'client' ? 'Client' : 'Utilisateur'}</td><td className="px-5 py-3 font-semibold text-white">{fmt(p.montantNetUtilisateur ?? 0)}</td><td className="px-5 py-3 text-xs text-gray-500">{new Date(p.createdAt).toLocaleString('fr-FR')}</td></tr>)}
          {!data.paiements.length && <tr><td colSpan={7} className="text-center text-gray-500 py-10">Aucun paiement en ligne.</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  );
}

// ==================== Tarifs ====================

function Tarifs() {
  const [tarifs, setTarifs] = useState<any>(null);
  const [fedapayFeePercent, setFedapayFeePercent] = useState(2.5);
  const [payoutFeeBrackets, setPayoutFeeBrackets] = useState<any[]>([]);
  const [reduction, setReduction] = useState(19);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    adminApi.get('/admin/pricing').then((res) => {
      setTarifs(res.data.tarifs);
      setFedapayFeePercent(res.data.fedapayFeePercent);
      setPayoutFeeBrackets(res.data.payoutFeeBrackets || []);
      setReduction(res.data.reductionAbonnementPercent ?? 19);
    }).finally(() => setChargement(false));
  }, []);

  const majMensuel = (plan: 'pro' | 'business', valeur: string) => {
    const mensuel = Math.max(0, Number(valeur) || 0);
    const facteur = 1 - (reduction / 100);
    setTarifs((t: any) => ({
      ...t,
      [plan]: {
        ...t[plan],
        1: mensuel,
        6: Math.round(mensuel * 6 * facteur),
        12: Math.round(mensuel * 12 * facteur),
      },
    }));
  };

  const enregistrer = async () => {
    setEnregistrement(true);
    setMessage('');
    try {
      const res = await adminApi.put('/admin/pricing', { tarifs, fedapayFeePercent, payoutFeeBrackets });
      setTarifs(res.data.tarifs);
      setMessage('Tarifs enregistrés. Les durées 6 mois et 1 an sont recalculées automatiquement.');
    } catch (err: any) {
      setMessage(err?.response?.data?.message || 'Impossible d’enregistrer les tarifs.');
    } finally {
      setEnregistrement(false);
    }
  };

  if (chargement || !tarifs) return <div className="flex justify-center py-20"><div className="spinner" /></div>;

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div>
        <h2 className="text-xl font-extrabold text-white">Abonnements & tarifs</h2>
        <p className="text-sm text-gray-500 mt-1">Le prix mensuel est la seule valeur de référence. Les engagements 6 mois et 1 an suivent automatiquement la réduction de {reduction}%.</p>
      </div>

      <div className="rounded-2xl bg-[#d9524d]/10 border border-[#d9524d]/20 p-4">
        <p className="text-sm font-semibold text-white flex items-center gap-2"><Settings2 size={16} className="text-[#f4847d]" /> Règle tarifaire unique</p>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">Tu modifies uniquement le prix 1 mois. Oryxa recalcule immédiatement les deux autres durées : <strong className="text-gray-200">prix × durée × 81%</strong>. Cela évite qu'un ancien prix reste différent entre l'interface publique, le paiement FedaPay et l'administration.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {(['pro', 'business'] as const).map((plan) => (
          <div key={plan} className="glass-card p-5">
            <div className="flex items-center justify-between mb-4"><div><p className="text-base font-bold text-white capitalize">Plan {plan}</p><p className="text-xs text-gray-500">Prix de référence mensuel</p></div><span className="badge badge-payee">− {reduction}%</span></div>
            <div className="mb-5">
              <label className="field-label">1 mois (FCFA)</label>
              <input type="number" min="0" className="field text-lg font-bold" value={tarifs[plan]?.[1] ?? 0} onChange={(e) => majMensuel(plan, e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="field-label">6 mois</label><input type="text" className="field opacity-80" value={`${new Intl.NumberFormat('fr-FR').format(tarifs[plan]?.[6] ?? 0)} FCFA`} readOnly /></div>
              <div><label className="field-label">1 an</label><input type="text" className="field opacity-80" value={`${new Intl.NumberFormat('fr-FR').format(tarifs[plan]?.[12] ?? 0)} FCFA`} readOnly /></div>
            </div>
            <p className="text-[11px] text-gray-500 mt-3">Les montants calculés ici sont ceux utilisés ensuite par le parcours d'abonnement.</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-1"><WalletCards size={17} className="text-[#f4847d]" /><p className="text-sm font-semibold text-white">Barème payout prévisionnel</p></div>
        <p className="text-xs text-gray-500 mb-4">Utilisé pour afficher les frais de transfert avant que FedaPay retourne le coût réel.</p>
        <div className="space-y-2">
          {payoutFeeBrackets.map((b, i) => <div key={i} className="grid grid-cols-2 gap-3"><input type="number" className="field" value={b.seuilMax >= 900000000 ? '' : b.seuilMax} placeholder="Jusqu'à…" onChange={(e) => setPayoutFeeBrackets((arr) => arr.map((x, j) => j === i ? { ...x, seuilMax: Number(e.target.value) || x.seuilMax } : x))} /><input type="number" className="field" value={b.frais} onChange={(e) => setPayoutFeeBrackets((arr) => arr.map((x, j) => j === i ? { ...x, frais: Number(e.target.value) || 0 } : x))} /></div>)}
        </div>
      </div>

      <div className="glass-card p-5">
        <label className="field-label">Frais FedaPay moyens estimés (%)</label>
        <input type="number" step="0.1" min="0" max="99" className="field max-w-[160px]" value={fedapayFeePercent} onChange={(e) => setFedapayFeePercent(Number(e.target.value) || 0)} />
        <p className="text-xs text-gray-500 mt-1.5">Cette valeur sert uniquement aux estimations financières administratives. Elle ne remplace jamais les frais réellement retournés par FedaPay.</p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={enregistrer} disabled={enregistrement} className="btn-primary">{enregistrement ? 'Enregistrement…' : 'Enregistrer les paramètres'}</button>
        {message && <span className="text-sm text-emerald-300">{message}</span>}
      </div>
    </div>
  );
}


// ==================== Affiliation ====================
function AffiliationAdmin() {
  const [overview, setOverview] = useState<any>(null);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    const [o, a] = await Promise.all([adminApi.get('/admin/affiliation/overview'), adminApi.get('/admin/affiliation/affiliates')]);
    setOverview(o.data); setAffiliates(a.data.affiliates || []);
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const update = (key: string, value: any) => setOverview((x: any) => ({ ...x, settings: { ...x.settings, [key]: value } }));
  const save = async () => {
    setSaving(true); setMessage('');
    try { await adminApi.put('/admin/affiliation/settings', overview.settings); await load(); setMessage('Paramètres d’affiliation enregistrés.'); }
    catch (e: any) { setMessage(e?.response?.data?.message || 'Impossible d’enregistrer.'); }
    finally { setSaving(false); }
  };
  if (!overview) return <div className="flex justify-center py-20"><div className="spinner" /></div>;

  return <div className="flex flex-col gap-5">
    <div><h1 className="text-2xl font-extrabold text-white">Programme d’affiliation</h1><p className="text-sm text-gray-500 mt-1">Un compte Oryxa peut être client, affilié, ou les deux. Les commissions sont déclenchées uniquement par les abonnements réellement payés.</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {[[Gift,'Affiliés',overview.stats.affiliates],[MousePointerClick,'Clics',overview.stats.clicks],[Users,'Filleuls',overview.stats.referrals],[Check,'Clients payants',overview.stats.paidReferrals],[WalletCards,'Commissions',fmt(overview.stats.commissions)]].map(([Icon,label,value]: any) => <div className="glass-card p-4" key={label}><Icon size={18} className="text-[#f4847d]"/><p className="text-xs text-gray-500 mt-3">{label}</p><p className="text-lg font-extrabold text-white mt-1">{value}</p></div>)}
    </div>
    <div className="glass-card p-5">
      <div className="flex items-center justify-between gap-3 mb-5"><div><h2 className="font-bold text-white">Règles du programme</h2><p className="text-xs text-gray-500 mt-1">Tout est modifiable ici sans changer le code.</p></div><label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={!!overview.settings.enabled} onChange={e => update('enabled', e.target.checked)} className="accent-[#d9524d]"/> Programme actif</label></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div><label className="field-label">Réduction filleul (%)</label><input className="field" type="number" min="0" max="100" value={overview.settings.discountPercent} onChange={e => update('discountPercent', Number(e.target.value))}/></div>
        <div><label className="field-label">Durée de réduction (mois)</label><input className="field" type="number" min="1" max="12" value={overview.settings.discountMonths} onChange={e => update('discountMonths', Number(e.target.value))}/></div>
        <div><label className="field-label">Commission Pro (FCFA)</label><input className="field" type="number" min="0" value={overview.settings.commissionPro} onChange={e => update('commissionPro', Number(e.target.value))}/></div>
        <div><label className="field-label">Commission Business (FCFA)</label><input className="field" type="number" min="0" value={overview.settings.commissionBusiness} onChange={e => update('commissionBusiness', Number(e.target.value))}/></div>
      </div>
      <div className="mt-5 flex items-center gap-3"><button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>{message && <span className="text-sm text-emerald-300">{message}</span>}</div>
    </div>
    <div className="glass-card p-5 overflow-x-auto"><h2 className="font-bold text-white mb-4">Affiliés inscrits</h2><table className="w-full min-w-[850px] text-sm"><thead><tr className="text-left text-xs text-gray-500 border-b border-white/10"><th className="py-2">Affilié</th><th>Code</th><th>Clics</th><th>Filleuls</th><th>Payants</th><th>Commissions</th><th>Statut</th></tr></thead><tbody>{affiliates.map(a => <tr key={a._id} className="border-b border-white/5"><td className="py-3 text-white">{a.user?.nom}<div className="text-xs text-gray-500">{a.user?.email}</div></td><td className="font-mono text-[#f4847d]">{a.code}</td><td>{a.clicks}</td><td>{a.referrals}</td><td>{a.paidReferrals}</td><td>{fmt(a.commissions)}</td><td>{a.active ? 'Actif' : 'Désactivé'}</td></tr>)}{!affiliates.length && <tr><td colSpan={7} className="py-10 text-center text-gray-500">Aucun affilié.</td></tr>}</tbody></table></div>
  </div>;
}

// ==================== Contenu légal ====================

const PAGES_LEGALES = [
  { slug: 'cgu', label: 'CGU' },
  { slug: 'confidentialite', label: 'Politique de confidentialité' },
  { slug: 'mentions-legales', label: 'Mentions légales' },
] as const;

function ContenuLegal() {
  const [slug, setSlug] = useState<typeof PAGES_LEGALES[number]['slug']>('cgu');
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setChargement(true);
    setMessage('');
    adminApi.get('/admin/legal').then((res) => {
      const doc = res.data.find((d: any) => d.slug === slug);
      setTitre(doc?.titre || '');
      setContenu(doc?.contenu || '');
    }).finally(() => setChargement(false));
  }, [slug]);

  const enregistrer = async () => {
    setEnregistrement(true);
    setMessage('');
    try {
      await adminApi.put(`/admin/legal/${slug}`, { titre, contenu });
      setMessage('Contenu enregistré — visible immédiatement sur le site, sans redéploiement.');
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {PAGES_LEGALES.map((p) => (
          <button
            key={p.slug}
            onClick={() => setSlug(p.slug)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-soft ${
              slug === p.slug ? 'text-white bg-white/10 border border-white/10' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {chargement ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            Laisser vide pour utiliser le contenu par défaut du site. Format texte simple
            (les lignes commençant par # deviennent des titres).
          </p>
          <div>
            <label className="field-label">Titre (optionnel — vide = titre par défaut)</label>
            <input className="field" value={titre} onChange={(e) => setTitre(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Contenu (optionnel — vide = contenu par défaut)</label>
            <textarea
              className="field font-mono text-sm"
              rows={16}
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              placeholder="Laisser vide pour garder le contenu par défaut du site…"
            />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={enregistrer} disabled={enregistrement} className="btn-primary">
              {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {message && <span className="text-sm" style={{ color: '#6ee7b7' }}>{message}</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ==================== Support ====================

interface SupportMessage { _id: string; auteurType: 'utilisateur' | 'admin'; auteurNom: string; message: string; createdAt: string; }
interface SupportTicket { _id: string; numero: string; sujet: string; categorie: string; statut: string; dernierMessagePar: string; dernierMessageLuAdmin: boolean; createdAt: string; updatedAt: string; messages: SupportMessage[]; owner?: { nom: string; email: string; entreprise?: string }; }

const supportStatus: Record<string, string> = { nouveau: 'Nouveau', en_cours: 'En cours', resolu: 'Résolu', ferme: 'Fermé' };

function SupportAdmin() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [status, setStatus] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get('/admin/support', { params: { statut: status } });
      setTickets(res.data.tickets); setUnread(res.data.nonLus);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status]);

  const open = async (id: string) => {
    const t = (await adminApi.get(`/admin/support/${id}`)).data.ticket;
    setSelected(t); setUnread((n) => Math.max(0, n - (t.dernierMessagePar === 'utilisateur' && !t.dernierMessageLuAdmin ? 1 : 0)));
  };

  const replyTo = async () => {
    if (!selected || !reply.trim()) return;
    setBusy(true); setError('');
    try { const t = (await adminApi.post(`/admin/support/${selected._id}/messages`, { message: reply, statut: 'en_cours' })).data.ticket; setSelected(t); setReply(''); await load(); }
    catch (e: any) { setError(e.response?.data?.message || 'Impossible d’envoyer la réponse.'); }
    finally { setBusy(false); }
  };

  const changeStatus = async (next: string) => {
    if (!selected) return;
    setBusy(true); setError('');
    try { const t = (await adminApi.patch(`/admin/support/${selected._id}/status`, { statut: next })).data.ticket; setSelected(t); await load(); }
    catch (e: any) { setError(e.response?.data?.message || 'Impossible de modifier le statut.'); }
    finally { setBusy(false); }
  };

  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold text-white">Support client</h1><p className="text-sm text-gray-500 mt-1">Demandes reçues depuis les espaces Oryxa.</p></div>
      <div className="flex items-center gap-2"><span className="text-xs text-gray-400">Non lues : <strong className="text-white">{unread}</strong></span><Select value={status} onChange={setStatus} options={[{value:"",label:"Toutes"},{value:"nouveau",label:"Nouvelles"},{value:"en_cours",label:"En cours"},{value:"resolu",label:"Résolues"},{value:"ferme",label:"Fermées"}]} className="!w-auto !py-2" /></div>
    </div>
    {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 text-sm">{error}</div>}
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-2 glass-card overflow-hidden">
        {loading ? <div className="flex justify-center py-16"><div className="spinner" /></div> : tickets.length === 0 ? <div className="p-10 text-center text-gray-500">Aucune demande.</div> : tickets.map(t => <button key={t._id} onClick={() => open(t._id)} className={`w-full text-left p-4 border-b border-white/10 hover:bg-white/5 ${selected?._id === t._id ? 'bg-white/5' : ''}`}><div className="flex justify-between gap-2"><span className="text-xs text-gray-500">{t.numero}</span>{!t.dernierMessageLuAdmin && t.dernierMessagePar === 'utilisateur' && <span className="badge" style={{color:'#f4847d'}}>Nouveau message</span>}</div><p className="font-semibold text-white mt-2 truncate">{t.sujet}</p><p className="text-xs text-gray-500 mt-1">{t.owner?.nom} · {t.owner?.email}</p><p className="text-xs text-gray-500 mt-1">{supportStatus[t.statut] || t.statut} · {new Date(t.updatedAt).toLocaleString('fr-FR')}</p></button>)}
      </div>
      <div className="lg:col-span-3 glass-card p-5 min-h-[480px]">
        {!selected ? <div className="h-full min-h-[420px] flex items-center justify-center text-gray-500">Sélectionnez une demande.</div> : <>
          <div className="border-b border-white/10 pb-4 mb-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-gray-500">{selected.numero} · {selected.owner?.email}</p><h2 className="text-xl font-bold text-white mt-1">{selected.sujet}</h2></div><Select value={selected.statut} onChange={changeStatus} disabled={busy} options={[{value:"nouveau",label:"Nouveau"},{value:"en_cours",label:"En cours"},{value:"resolu",label:"Résolu"},{value:"ferme",label:"Fermé"}]} className="!w-auto !py-2" /></div></div>
          <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">{selected.messages.map(m => <div key={m._id} className={`rounded-2xl p-4 ${m.auteurType === 'admin' ? 'bg-[#d9524d]/10 border border-[#d9524d]/20' : 'bg-white/5'}`}><div className="flex justify-between gap-3 text-xs text-gray-500 mb-2"><span className="font-semibold text-gray-300">{m.auteurType === 'admin' ? 'Support Oryxa' : m.auteurNom}</span><span>{new Date(m.createdAt).toLocaleString('fr-FR')}</span></div><p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{m.message}</p></div>)}</div>
          {selected.statut !== 'ferme' && <div className="mt-4 flex gap-2"><textarea className="field min-h-[90px]" value={reply} onChange={e => setReply(e.target.value)} placeholder="Répondre au client…" /><button className="btn-primary self-end" disabled={busy || !reply.trim()} onClick={replyTo}>Répondre</button></div>}
        </>}
      </div>
    </div>
  </div>;
}

// ==================== Racine ====================

export default function AdminDashboard() {
  return (
    <AdminShell>
      <Routes>
        <Route index element={<VueEnsemble />} />
        <Route path="utilisateurs" element={<Utilisateurs />} />
        <Route path="paiements" element={<Paiements />} />
        <Route path="finance" element={<Finance />} />
        <Route path="tarifs" element={<Tarifs />} />
        <Route path="legal" element={<ContenuLegal />} />
        <Route path="support" element={<SupportAdmin />} />
        <Route path="affiliation" element={<AffiliationAdmin />} />
      </Routes>
    </AdminShell>
  );
}
