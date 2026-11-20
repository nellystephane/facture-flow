import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Download, Lock, X, LineChart as LineIcon, PieChart as PieIcon } from 'lucide-react';
import {
  getAnalytics, getAnalyticsCatalog,
  type AnalyticsSource, type AnalyticsQuery, type AnalyticsCatalog, type AnalyticsResult, type GroupBy, type MetricInfo, type Period,
} from '../../api/analytics';
import { apiError } from '../../utils/format';
import ModalPortal from '../ui/ModalPortal';
import SeriesChart from './SeriesChart';
import BreakdownChart from './BreakdownChart';
import { PALETTE, bucketLabelLong, formatValue, toCsv } from './chartUtils';

interface ChartModalProps {
  onClose: () => void;
  title?: string;
  /** Éléments cochés à l'ouverture. L'utilisateur peut ensuite en choisir d'autres. */
  initialMetrics: string[];
  initialPeriod?: Period;
  /** Source de données alternative (ex. analyses de l'espace admin). Par défaut : les chiffres de l'utilisateur. */
  source?: AnalyticsSource;
}

const PERIOD_LABEL: Record<Period, string> = {
  '30j': '30 jours', '90j': '90 jours', '6m': '6 mois', '12m': '12 mois', annee: 'Cette année', custom: 'Personnalisée',
};
const PERIODS: Period[] = ['30j', '90j', '6m', '12m', 'annee', 'custom'];
const GROUP_LABEL: Record<'auto' | GroupBy, string> = { auto: 'Auto', day: 'Jour', week: 'Semaine', month: 'Mois' };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default function ChartModal({ onClose, title = 'Analyser mes chiffres', initialMetrics, initialPeriod = '6m', source }: ChartModalProps) {
  const fetchCatalog = source?.catalog ?? getAnalyticsCatalog;
  const fetchData = source?.query ?? ((q: AnalyticsQuery) => getAnalytics(q));
  const [catalog, setCatalog] = useState<AnalyticsCatalog | null>(null);
  const [selected, setSelected] = useState<string[]>(initialMetrics);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [groupBy, setGroupBy] = useState<'auto' | GroupBy>('auto');
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [seriesType, setSeriesType] = useState<'line' | 'bar'>('bar');
  const [breakType, setBreakType] = useState<'donut' | 'bars'>('donut');
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  useEffect(() => {
    fetchCatalog().then((r) => setCatalog(r.data)).catch((e) => setError(apiError(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seuls les éléments disponibles pour le plan sont réellement demandés.
  const usable = useMemo(() => {
    if (!catalog) return [];
    const open = new Set(catalog.metrics.filter((m) => !m.locked).map((m) => m.id));
    return selected.filter((id) => open.has(id));
  }, [catalog, selected]);

  useEffect(() => {
    if (!catalog) return;
    if (!usable.length) { setData(null); setLoading(false); return; }
    const id = ++reqId.current;
    setLoading(true);
    setError('');
    const t = setTimeout(() => {
      fetchData({ metrics: usable, period, groupBy, from, to })
        .then((r) => { if (id === reqId.current) setData(r.data); })
        .catch((e) => { if (id === reqId.current) { setError(apiError(e)); setData(null); } })
        .finally(() => { if (id === reqId.current) setLoading(false); });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, usable, period, groupBy, from, to]);

  const toggle = (m: MetricInfo) => {
    if (m.locked) return;
    setSelected((cur) => (cur.includes(m.id) ? cur.filter((x) => x !== m.id) : cur.length >= 8 ? cur : [...cur, m.id]));
  };

  const grouped = useMemo(() => {
    const map = new Map<string, MetricInfo[]>();
    (catalog?.metrics || []).forEach((m) => map.set(m.group, [...(map.get(m.group) || []), m]));
    return [...map.entries()];
  }, [catalog]);

  const colorOf = (id: string) => PALETTE[Math.max(0, usable.indexOf(id)) % PALETTE.length];
  const hasLocked = !!catalog && !catalog.statistiquesAvancees;
  const money = data?.series.filter((s) => s.unit === 'fcfa') || [];
  const counts = data?.series.filter((s) => s.unit === 'count') || [];

  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [];
    if (data.series.length) {
      rows.push(['Période', ...data.series.map((s) => s.label)]);
      data.buckets.forEach((b, i) => rows.push([bucketLabelLong(b, data.range.groupBy), ...data.series.map((s) => s.values[i])]));
      rows.push([]);
    }
    data.breakdowns.forEach((b) => {
      rows.push([b.label, 'Valeur']);
      b.items.forEach((it) => rows.push([it.label, it.value]));
      rows.push([]);
    });
    const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'oryxa-analyse.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModalPortal onClose={onClose} sheet label={title}>
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="modal-title flex items-center gap-2"><BarChart3 size={20} className="text-[#d9524d]" /> {title}</h3>
            <p className="modal-sub">Cochez ce que vous voulez voir, le graphique se met à jour.</p>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>

        {/* Choix des éléments */}
        <div className="space-y-3 mb-5">
          {!catalog && !error && <div className="h-16 skeleton" />}
          {grouped.map(([group, items]) => (
            <div key={group}>
              <p className="modal-group">{group}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((m) => {
                  const on = selected.includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggle(m)} disabled={m.locked} aria-pressed={on}
                      title={m.locked ? 'Disponible avec le plan Pro' : undefined}
                      className={`chip ${on && !m.locked ? 'is-on' : ''}`}>
                      {m.locked && <Lock size={11} />}
                      {on && !m.locked && <span className="w-2 h-2 rounded-full" style={{ background: colorOf(m.id) }} />}
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {hasLocked && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Les éléments avec un cadenas sont inclus dans le plan Pro. <Link to="/app/abonnement" onClick={onClose} className="font-semibold text-[#d9524d] hover:underline">Voir les plans</Link>
            </p>
          )}
        </div>

        {/* Période et affichage */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-5 pb-5 border-b border-black/10 dark:border-white/10">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Période">
            {PERIODS.map((p) => (
              <button key={p} type="button" onClick={() => setPeriod(p)} aria-pressed={period === p}
                className={`seg ${period === p ? 'is-on' : ''}`}>
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input type="date" className="field py-1.5 w-auto" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-gray-400">au</span>
              <input type="date" className="field py-1.5 w-auto" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            <select className="field field-sm w-auto" value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'auto' | GroupBy)} aria-label="Regrouper par">
              {(Object.keys(GROUP_LABEL) as ('auto' | GroupBy)[]).map((g) => <option key={g} value={g}>{g === 'auto' ? 'Regroupement auto' : `Par ${GROUP_LABEL[g].toLowerCase()}`}</option>)}
            </select>
            <button type="button" className="btn-icon" title="Barres" onClick={() => { setSeriesType('bar'); setBreakType('bars'); }} aria-pressed={seriesType === 'bar'}><BarChart3 size={16} /></button>
            <button type="button" className="btn-icon" title="Courbes" onClick={() => setSeriesType('line')} aria-pressed={seriesType === 'line'}><LineIcon size={16} /></button>
            <button type="button" className="btn-icon" title="Anneau" onClick={() => setBreakType('donut')} aria-pressed={breakType === 'donut'}><PieIcon size={16} /></button>
            <button type="button" className="btn-icon" title="Exporter en CSV" onClick={exportCsv} disabled={!data}><Download size={16} /></button>
          </div>
        </div>

        {error && <p className="text-sm text-[#b23c37] bg-[rgba(217,82,77,0.08)] rounded-xl px-4 py-3 mb-4">{error}</p>}

        {!usable.length && catalog && !error && (
          <p className="text-sm text-[#555862] dark:text-gray-300 text-center py-12">Choisissez au moins un élément à analyser.</p>
        )}

        {loading && usable.length > 0 && <div className="h-72 skeleton" />}

        {!loading && data && (
          <div className="space-y-8">
            {[money, counts].map((group, gi) => group.length > 0 && (
              <div key={gi}>
                <div className="flex flex-wrap gap-2 mb-3">
                  {group.map((s) => (
                    <span key={s.id} className="legend-pill">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: colorOf(s.id) }} />
                      {s.label} : <b className="text-[#0a0a0c] dark:text-white tabular-nums">{formatValue(s.total, s.unit)}</b>
                    </span>
                  ))}
                </div>
                <div className="text-[#14151a] dark:text-white">
                  <SeriesChart key={`${seriesType}-${data.range.groupBy}-${group.map((s) => s.id).join()}`} buckets={data.buckets} series={group} colors={group.map((s) => colorOf(s.id))} groupBy={data.range.groupBy} type={seriesType} />
                </div>
              </div>
            ))}
            {data.breakdowns.map((b) => (
              <div key={b.id}>
                <p className="text-sm font-bold text-[#0a0a0c] dark:text-white mb-3">{b.label}</p>
                <div className="text-[#14151a] dark:text-white">
                  <BreakdownChart key={`${b.id}-${breakType}`} data={b} type={breakType} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalPortal>
  );
}
