import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Download, ScrollText, ServerCog, ShieldAlert, X, XCircle } from 'lucide-react';
import adminApi from '../../api/adminAxios';
import type { AnalyticsCatalog, AnalyticsQuery, AnalyticsResult, AnalyticsSource } from '../../api/analytics';
import ChartButton from '../../components/charts/ChartButton';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';
const dateHeure = (d?: string | null) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

// Source de données des graphiques de l'espace admin (mêmes écrans que côté utilisateur).
export const adminAnalyticsSource: AnalyticsSource = {
  catalog: () => adminApi.get<AnalyticsCatalog>('/admin/analytics/catalog'),
  query: (q: AnalyticsQuery) => adminApi.get<AnalyticsResult>('/admin/analytics', {
    params: {
      metrics: q.metrics.join(','), period: q.period,
      groupBy: q.groupBy && q.groupBy !== 'auto' ? q.groupBy : undefined,
      from: q.period === 'custom' ? q.from : undefined, to: q.period === 'custom' ? q.to : undefined,
    },
  }),
};

export function AdminChartButton({ metrics, title, label }: { metrics: string[]; title: string; label?: string }) {
  return <ChartButton metrics={metrics} title={title} label={label} source={adminAnalyticsSource} />;
}

export async function telechargerCsv(chemin: string, nom: string) {
  const res = await adminApi.get(chemin, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url; a.download = nom; a.click();
  URL.revokeObjectURL(url);
}

// ==================== Fiche utilisateur (fenêtre) ====================

interface UserDetail {
  user: { _id: string; nom: string; email: string; entreprise?: string; telephone?: string; whatsapp?: string; subscription: string; suspendu: boolean; suspensionMotif?: string; emailVerifie: boolean; createdAt: string; abonnement?: { dateFin?: string | null } };
  activite: { factures: number; clients: number; membresEquipe: number; facturesPayees: number; chiffreAffairesFacture: number; encaisse: number; soldeRetirable: number; tickets: number };
  abonnements: { _id: string; plan: string; duree: string; montant: number; statut: string; dateFin?: string | null; createdAt: string }[];
  affiliation: { code: string; actif: boolean; clics: number; filleuls: number; commissions: number } | null;
  parraine: { code: string; par: string; statut: string } | null;
}

export function UserDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<UserDetail | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    adminApi.get(`/admin/users/${id}`).then((r) => setData(r.data)).catch(() => setErreur('Impossible de charger ce compte.'));
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const Ligne = ({ l, v }: { l: string; v: string | number }) => (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100 text-sm"><span className="text-gray-500">{l}</span><span className="font-semibold text-right">{v}</span></div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 fx-modal-backdrop" style={{ background: 'rgba(10,10,12,0.55)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-bold">{data?.user.nom || 'Compte'}</h3>
            <p className="text-xs text-gray-500">{data?.user.email}{data?.user.entreprise ? ` · ${data.user.entreprise}` : ''}</p>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        {erreur && <p className="text-sm text-[#b23c37]">{erreur}</p>}
        {!data && !erreur && <div className="h-48 skeleton" />}
        {data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[['Factures', data.activite.factures], ['Clients', data.activite.clients], ['Payées', data.activite.facturesPayees], ['Équipe', data.activite.membresEquipe]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-gray-50 p-3"><p className="text-[11px] text-gray-500 uppercase tracking-wide">{l}</p><p className="text-xl font-extrabold tabular-nums">{v}</p></div>
              ))}
            </div>
            <div>
              <p className="text-sm font-bold mb-1">Compte</p>
              <Ligne l="Plan" v={data.user.subscription} />
              <Ligne l="Fin d’abonnement" v={data.user.abonnement?.dateFin ? new Date(data.user.abonnement.dateFin).toLocaleDateString('fr-FR') : '—'} />
              <Ligne l="E-mail confirmé" v={data.user.emailVerifie ? 'Oui' : 'Non'} />
              <Ligne l="Statut" v={data.user.suspendu ? `Suspendu${data.user.suspensionMotif ? ` (${data.user.suspensionMotif})` : ''}` : 'Actif'} />
              <Ligne l="Téléphone" v={data.user.telephone || data.user.whatsapp || '—'} />
              <Ligne l="Inscrit le" v={new Date(data.user.createdAt).toLocaleDateString('fr-FR')} />
            </div>
            <div>
              <p className="text-sm font-bold mb-1">Activité financière</p>
              <Ligne l="Chiffre d’affaires facturé (payé)" v={fmt(data.activite.chiffreAffairesFacture)} />
              <Ligne l="Encaissé" v={fmt(data.activite.encaisse)} />
              <Ligne l="Solde retirable" v={fmt(data.activite.soldeRetirable)} />
              <Ligne l="Tickets de support" v={data.activite.tickets} />
            </div>
            {data.abonnements.length > 0 && (
              <div>
                <p className="text-sm font-bold mb-1">Abonnements</p>
                {data.abonnements.map((s) => (
                  <Ligne key={s._id} l={`${s.plan} · ${s.duree} · ${new Date(s.createdAt).toLocaleDateString('fr-FR')}`} v={`${fmt(s.montant)} (${s.statut})`} />
                ))}
              </div>
            )}
            {(data.affiliation || data.parraine) && (
              <div>
                <p className="text-sm font-bold mb-1">Parrainage</p>
                {data.affiliation && <><Ligne l="Code" v={data.affiliation.code} /><Ligne l="Visites / filleuls" v={`${data.affiliation.clics} / ${data.affiliation.filleuls}`} /><Ligne l="Commissions gagnées" v={fmt(data.affiliation.commissions)} /></>}
                {data.parraine && <Ligne l="Parrainé par" v={`${data.parraine.par} (${data.parraine.statut})`} />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Journal d'audit ====================

interface Audit { _id: string; adminEmail: string; method: string; path: string; status: number | null; success: boolean; ip: string; createdAt: string }
interface Evenement { _id: string; type: string; scope: string; severity: string; identifier: string; ip: string; details: string; createdAt: string }

export function JournalAudit() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [echecs, setEchecs] = useState(false);
  const [methode, setMethode] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    adminApi.get('/admin/audit', { params: { page, echecs: echecs ? '1' : undefined, methode: methode || undefined } })
      .then((r) => { setAudits(r.data.audits); setPages(r.data.pages || 1); if (page === 1) setEvenements(r.data.evenements || []); })
      .finally(() => setChargement(false));
  }, [page, echecs, methode]);

  return (
    <div className="flex flex-col gap-5">
      {evenements.length > 0 && (
        <div className="glass-card p-5">
          <p className="font-bold flex items-center gap-2 mb-3"><ShieldAlert size={17} className="text-[#d9524d]" /> Événements de sécurité à surveiller</p>
          <ul className="divide-y divide-gray-100 text-sm">
            {evenements.map((e) => (
              <li key={e._id} className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${e.severity === 'critical' ? 'bg-[rgba(217,82,77,0.12)] text-[#b23c37]' : 'bg-[#fff4dc] text-[#9a6a00]'}`}>{e.severity === 'critical' ? 'Critique' : 'Alerte'}</span>
                <span className="font-semibold">{e.type}</span>
                <span className="text-gray-500 truncate">{e.identifier || e.details}</span>
                <span className="text-xs text-gray-400 ml-auto">{dateHeure(e.createdAt)}{e.ip ? ` · ${e.ip}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass-card p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <p className="font-bold flex items-center gap-2"><ScrollText size={17} /> Actions d’administration</p>
          <div className="ml-auto flex items-center gap-2">
            <select className="field w-auto py-1.5 text-xs" value={methode} onChange={(e) => { setPage(1); setMethode(e.target.value); }} aria-label="Méthode">
              <option value="">Toutes les actions</option><option value="POST">Créations (POST)</option><option value="PATCH">Modifications (PATCH)</option><option value="PUT">Remplacements (PUT)</option><option value="DELETE">Suppressions</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"><input type="checkbox" checked={echecs} onChange={(e) => { setPage(1); setEchecs(e.target.checked); }} /> Échecs seulement</label>
          </div>
        </div>
        {chargement ? <div className="h-40 skeleton" /> : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[680px]">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100"><th className="px-5 py-2 font-medium">Quand</th><th className="px-5 py-2 font-medium">Admin</th><th className="px-5 py-2 font-medium">Action</th><th className="px-5 py-2 font-medium">Résultat</th></tr></thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={a._id} className="border-b border-gray-50">
                    <td className="px-5 py-2.5 text-gray-500 whitespace-nowrap">{dateHeure(a.createdAt)}</td>
                    <td className="px-5 py-2.5">{a.adminEmail}</td>
                    <td className="px-5 py-2.5"><span className="font-semibold">{a.method}</span> <span className="text-gray-500">{a.path.replace('/api/admin', '')}</span></td>
                    <td className="px-5 py-2.5">{a.success ? <span className="text-[#0f7a55] font-semibold">{a.status}</span> : <span className="text-[#b23c37] font-semibold">{a.status ?? 'erreur'}</span>}</td>
                  </tr>
                ))}
                {!audits.length && <tr><td colSpan={4} className="text-center text-gray-400 py-10">Aucune action enregistrée</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <button className="btn-ghost text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button>
            <span className="text-gray-500">Page {page} / {pages}</span>
            <button className="btn-ghost text-xs" disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== État du système ====================

interface Systeme {
  environnement: string; fedapayEnvironnement: string | null; base: boolean;
  configuration: { cle: string; ok: boolean; aide: string }[];
  taches: { nom: string; derniereExecution: string | null; enCours: boolean }[];
}

export function SystemeAdmin() {
  const [s, setS] = useState<Systeme | null>(null);
  useEffect(() => { adminApi.get('/admin/system').then((r) => setS(r.data)); }, []);
  if (!s) return <div className="h-64 skeleton" />;
  const manquants = s.configuration.filter((c) => !c.ok && !c.aide.includes('facultatif'));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid sm:grid-cols-3 gap-4 fx-stagger">
        <div className="glass-card p-5"><p className="text-xs text-gray-500 uppercase tracking-wide">Base de données</p><p className={`text-xl font-extrabold mt-2 flex items-center gap-2 ${s.base ? 'text-[#0f7a55]' : 'text-[#b23c37]'}`}>{s.base ? <CheckCircle2 size={20} /> : <XCircle size={20} />} {s.base ? 'Connectée' : 'Hors ligne'}</p></div>
        <div className="glass-card p-5"><p className="text-xs text-gray-500 uppercase tracking-wide">Environnement</p><p className="text-xl font-extrabold mt-2">{s.environnement}</p></div>
        <div className="glass-card p-5"><p className="text-xs text-gray-500 uppercase tracking-wide">FedaPay</p><p className="text-xl font-extrabold mt-2">{s.fedapayEnvironnement || 'non configuré'}</p></div>
      </div>

      {manquants.length > 0 && (
        <div className="rounded-2xl border border-[#f2cbc7] bg-[#fbe9e7] p-4 text-sm flex gap-3"><AlertTriangle size={18} className="text-[#b23c37] shrink-0 mt-0.5" />
          <p><b>{manquants.length} réglage(s) à compléter</b> avant de passer en production : {manquants.map((m) => m.cle).join(', ')}.</p></div>
      )}

      <div className="glass-card p-5">
        <p className="font-bold flex items-center gap-2 mb-3"><ServerCog size={17} /> Configuration</p>
        <ul className="divide-y divide-gray-100">
          {s.configuration.map((c) => (
            <li key={c.cle} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">{c.ok ? <CheckCircle2 size={16} className="text-[#10b981]" /> : <XCircle size={16} className="text-[#d9524d]" />} {c.cle}</span>
              <code className="text-xs text-gray-400">{c.ok ? 'OK' : c.aide}</code>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-400 mt-3">Seule la présence des réglages est affichée, jamais leurs valeurs.</p>
      </div>

      <div className="glass-card p-5">
        <p className="font-bold flex items-center gap-2 mb-3"><Activity size={17} /> Tâches planifiées</p>
        {s.taches.length === 0 ? <p className="text-sm text-gray-400">Aucune exécution enregistrée depuis le démarrage. Si votre hébergement s’endort, configurez le déclencheur externe (CRON_SECRET).</p> : (
          <ul className="divide-y divide-gray-100">
            {s.taches.map((t) => (
              <li key={t.nom} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span>{t.nom}</span><span className="text-gray-500 text-xs">{t.enCours ? 'En cours…' : `Dernière exécution : ${dateHeure(t.derniereExecution)}`}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function BoutonsExport() {
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-ghost text-xs" onClick={() => telechargerCsv('/admin/export/users.csv', 'oryxa-utilisateurs.csv')}><Download size={14} /> Exporter les utilisateurs</button>
      <button className="btn-ghost text-xs" onClick={() => telechargerCsv('/admin/export/abonnements.csv', 'oryxa-abonnements.csv')}><Download size={14} /> Exporter les abonnements</button>
    </div>
  );
}
