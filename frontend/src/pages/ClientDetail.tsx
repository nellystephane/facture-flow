import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Mail, Phone, MapPin, FileText, Wallet, Clock, AlertTriangle, UserRound } from 'lucide-react';
import { getClientHistorique, type ClientHistorique, type Fiabilite } from '../api/clients';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import ChartButton from '../components/charts/ChartButton';
import { useToast } from '../contexts/ToastContext';
import { apiError, formatFCFA, formatCompact, formatDate, badgeClass, INVOICE_STATUT_LABEL, METHODE_LABEL } from '../utils/format';
import type { InvoiceStatut, MethodePaiement } from '../types';

const FIABILITE: Record<Fiabilite, { label: string; color: string; hint: string }> = {
  nouveau: { label: 'Nouveau client', color: '#6b7280', hint: 'Pas encore assez d’historique' },
  bonne: { label: 'Paie à temps', color: '#10b981', hint: 'Règle ses factures dans les délais' },
  moyenne: { label: 'Parfois en retard', color: '#f59e0b', hint: 'Quelques retards de paiement' },
  a_surveiller: { label: 'À surveiller', color: '#d9524d', hint: 'Retards fréquents ou répétés' },
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ClientHistorique | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getClientHistorique(id)
      .then((r) => setData(r.data))
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div><div className="h-10 w-64 skeleton mb-8" /><div className="h-72 skeleton" /></div>;
  if (!data) {
    return (
      <div className="glass-card p-10 text-center">
        <p className="text-gray-500 mb-4">Client introuvable.</p>
        <Link to="/app/clients" className="btn-ghost"><ArrowLeft size={16} /> Retour aux clients</Link>
      </div>
    );
  }

  const { client, synthese, paiements, devis } = data;
  const fiab = FIABILITE[synthese.fiabilite];

  return (
    <div>
      <PageHeader
        title={client.nom}
        subtitle={client.entreprise || 'Fiche client'}
        icon={<UserRound size={20} />}
        actions={
          <>
            <Link to="/app/clients" className="btn-ghost text-sm"><ArrowLeft size={16} /> Clients</Link>
            <ChartButton metrics={['top_clients', 'encaissements']} title="Analyser mes clients" label="Graphiques" />
            <Link to={`/app/clients/${client._id}/edit`} className="btn-ghost text-sm"><Pencil size={16} /> Modifier</Link>
            <Link to={`/app/invoices/new?client=${client._id}`} className="btn-primary text-sm"><Plus size={18} /> Facturer</Link>
          </>
        }
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total facturé" value={formatCompact(synthese.totalFacture)} icon={<FileText size={22} />} accent="noir" tone="mint" trend={`${synthese.nombreFactures} facture(s)`} />
        <StatCard label="Déjà payé" value={formatCompact(synthese.totalPaye)} icon={<Wallet size={22} />} accent="vert" delay={0.08} />
        <StatCard label="Reste à payer" value={formatCompact(synthese.totalReste)} icon={<Clock size={22} />} accent="orange" delay={0.16}
          trend={synthese.nombreEnRetard ? `${synthese.nombreEnRetard} en retard` : 'Rien en retard'} />
        <StatCard label="Délai moyen de paiement" value={synthese.delaiMoyenJours === null ? '—' : `${synthese.delaiMoyenJours} jours`} icon={<AlertTriangle size={22} />} accent="bleu" delay={0.24}
          trend={synthese.tauxPonctualite === null ? undefined : `${synthese.tauxPonctualite} % réglées à temps`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 animate-fade-up delay-2">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-4">Factures</h3>
            {synthese.lignes.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Aucune facture pour ce client.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 dark:text-gray-500 uppercase border-b border-gray-100 dark:border-white/10">
                      <th className="px-2 pb-3 font-semibold">N°</th>
                      <th className="px-2 pb-3 font-semibold">Date</th>
                      <th className="px-2 pb-3 font-semibold">Montant</th>
                      <th className="px-2 pb-3 font-semibold">Reste</th>
                      <th className="px-2 pb-3 font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/10">
                    {synthese.lignes.map((l) => (
                      <tr key={l._id}>
                        <td className="px-2 py-3"><Link to={`/app/invoices/${l._id}`} className="font-semibold text-[#0a0a0c] dark:text-white hover:text-[#d9524d]">{l.numero}</Link></td>
                        <td className="px-2 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(l.dateEmission)}</td>
                        <td className="px-2 py-3 font-medium whitespace-nowrap">{formatFCFA(l.totalDu, l.devise)}</td>
                        <td className="px-2 py-3 whitespace-nowrap">{l.reste > 0 ? formatFCFA(l.reste, l.devise) : '—'}</td>
                        <td className="px-2 py-3"><span className={badgeClass(l.statut)}>{INVOICE_STATUT_LABEL[l.statut as InvoiceStatut] || l.statut}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="glass-card p-6 animate-fade-up delay-3">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-4">Derniers paiements</h3>
            {paiements.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Aucun paiement reçu pour l’instant.</p>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-white/10">
                {paiements.map((p) => (
                  <li key={p._id} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold text-[#0a0a0c] dark:text-white">{formatFCFA(p.montant, p.devise)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(p.date)} · {METHODE_LABEL[p.methode as MethodePaiement] || p.methode}{p.factureNumero ? ` · ${p.factureNumero}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">{p.origine === 'en_ligne' ? 'En ligne' : 'Saisi à la main'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 animate-fade-up delay-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">Fiabilité de paiement</p>
            <p className="mt-2 text-lg font-extrabold flex items-center gap-2" style={{ color: fiab.color }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: fiab.color }} /> {fiab.label}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{fiab.hint}. Calculé uniquement à partir de ses paiements passés.</p>
          </div>

          <div className="glass-card p-6 animate-fade-up delay-3">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-3">Coordonnées</h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              {client.email && <p className="flex items-center gap-2 break-all"><Mail size={14} className="shrink-0 text-gray-400" /> {client.email}</p>}
              {client.telephone && <p className="flex items-center gap-2"><Phone size={14} className="shrink-0 text-gray-400" /> {client.telephone}</p>}
              {client.adresse && <p className="flex items-center gap-2"><MapPin size={14} className="shrink-0 text-gray-400" /> {client.adresse}</p>}
              {!client.email && !client.telephone && !client.adresse && <p className="text-gray-400 italic text-xs">Aucune coordonnée</p>}
            </div>
            {client.notes && <p className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{client.notes}</p>}
          </div>

          <div className="glass-card p-6 animate-fade-up delay-4">
            <h3 className="font-bold text-[#0a0a0c] dark:text-white mb-3">Devis</h3>
            {devis.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun devis.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {devis.slice(0, 8).map((q) => (
                  <li key={q._id} className="flex justify-between gap-3">
                    <Link to={`/app/quotes/${q._id}`} className="font-semibold hover:text-[#d9524d]">{q.numero}</Link>
                    <span className="text-gray-500 dark:text-gray-400">{formatDate(q.dateEmission)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
