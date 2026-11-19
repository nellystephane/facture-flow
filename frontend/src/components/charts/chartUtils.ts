import type { GroupBy, MetricUnit } from '../../api/analytics';

export const PALETTE = ['#d9524d', '#14151a', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16'];

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Libellé court d'un intervalle : « nov. 26 », « 17 nov. » */
export function bucketLabel(key: string, groupBy: GroupBy): string {
  const [y, m, d] = key.split('-');
  const mois = MOIS[Number(m) - 1] || m;
  if (groupBy === 'month') return `${mois} ${y.slice(2)}`;
  return `${Number(d)} ${mois}`;
}

export function bucketLabelLong(key: string, groupBy: GroupBy): string {
  const [y, m, d] = key.split('-');
  const mois = MOIS[Number(m) - 1] || m;
  if (groupBy === 'month') return `${mois} ${y}`;
  if (groupBy === 'week') return `Semaine du ${Number(d)} ${mois} ${y}`;
  return `${Number(d)} ${mois} ${y}`;
}

export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * exp;
}

/** Nombre compact pour les axes : 12 500 -> « 12,5 k », 2 000 000 -> « 2 M ». */
export function axisNumber(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const fmt = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  if (abs >= 1_000_000) return `${sign}${fmt(abs / 1_000_000)} M`;
  if (abs >= 1_000) return `${sign}${fmt(abs / 1_000)} k`;
  return `${sign}${fmt(abs)}`;
}

export function formatValue(n: number, unit: MetricUnit): string {
  const s = Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
  return unit === 'fcfa' ? `${s} FCFA` : s;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
}
