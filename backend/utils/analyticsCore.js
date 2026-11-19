'use strict';

// ============================================================================
// Moteur d'analyse : logique pure (aucun accès base) pour que les graphiques
// du modal « Analyser » restent testables. Le contrôleur charge les données,
// ce module calcule les séries et répartitions demandées.
// Fuseau de référence : Bénin (UTC+1, pas d'heure d'été).
// ============================================================================

const { computeInvoiceTotals, paidAmountXOF, rateOf } = require('./invoiceTotals');

const OFFSET_MS = 3600 * 1000;
const DAY_MS = 86400000;

const METRICS = {
  encaissements: { label: 'Encaissements', kind: 'series', unit: 'fcfa', group: 'Argent', pro: false },
  depenses: { label: 'Dépenses', kind: 'series', unit: 'fcfa', group: 'Argent', pro: false },
  benefice: { label: 'Bénéfice (encaissé − dépenses)', kind: 'series', unit: 'fcfa', group: 'Argent', pro: true },
  factures_emises: { label: 'Montant facturé', kind: 'series', unit: 'fcfa', group: 'Argent', pro: true },
  impayes: { label: 'Impayés (par date d’émission)', kind: 'series', unit: 'fcfa', group: 'Argent', pro: true },
  nb_factures: { label: 'Nombre de factures', kind: 'series', unit: 'count', group: 'Activité', pro: true },
  nb_devis: { label: 'Nombre de devis', kind: 'series', unit: 'count', group: 'Activité', pro: true },
  nouveaux_clients: { label: 'Nouveaux clients', kind: 'series', unit: 'count', group: 'Activité', pro: true },
  commissions_affiliation: { label: 'Commissions de parrainage', kind: 'series', unit: 'fcfa', group: 'Parrainage', pro: false },
  nouveaux_filleuls: { label: 'Nouveaux filleuls', kind: 'series', unit: 'count', group: 'Parrainage', pro: false },
  repartition_statuts: { label: 'Factures par statut', kind: 'breakdown', unit: 'count', group: 'Répartitions', pro: false },
  repartition_methodes: { label: 'Encaissements par moyen de paiement', kind: 'breakdown', unit: 'fcfa', group: 'Répartitions', pro: false },
  depenses_categories: { label: 'Dépenses par catégorie', kind: 'breakdown', unit: 'fcfa', group: 'Répartitions', pro: false },
  top_clients: { label: 'Meilleurs clients (factures payées)', kind: 'breakdown', unit: 'fcfa', group: 'Répartitions', pro: true },
  anciennete_creances: { label: 'Impayés par ancienneté', kind: 'breakdown', unit: 'fcfa', group: 'Répartitions', pro: true },
  statuts_devis: { label: 'Devis par statut', kind: 'breakdown', unit: 'count', group: 'Répartitions', pro: true },
};

const STATUT_FACTURE = {
  brouillon: 'Brouillon', envoyee: 'Envoyée', vue: 'Vue', payee: 'Payée', en_retard: 'En retard', annulee: 'Annulée',
};
const STATUT_DEVIS = {
  brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé', expire: 'Expiré',
};
const METHODE = {
  especes: 'Espèces', mtn_money: 'MTN Money', moov_money: 'Moov Money', carte: 'Carte', virement: 'Virement', autre: 'Autre',
};
const CATEGORIE_DEPENSE = {
  loyer: 'Loyer', transport: 'Transport', materiel: 'Matériel', marketing: 'Marketing', salaires: 'Salaires',
  fournitures: 'Fournitures', internet_telephone: 'Internet & téléphone', taxes: 'Impôts & taxes', autre: 'Autre',
};

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const shifted = (d) => new Date(new Date(d).getTime() + OFFSET_MS);
const unshift = (ms) => new Date(ms - OFFSET_MS);

function startOfBucketMs(date, groupBy) {
  const t = shifted(date);
  const y = t.getUTCFullYear(); const m = t.getUTCMonth(); const d = t.getUTCDate();
  if (groupBy === 'month') return Date.UTC(y, m, 1);
  if (groupBy === 'week') return Date.UTC(y, m, d) - ((t.getUTCDay() + 6) % 7) * DAY_MS;
  return Date.UTC(y, m, d);
}

function nextBucketMs(ms, groupBy) {
  if (groupBy === 'month') { const t = new Date(ms); return Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1); }
  return ms + (groupBy === 'week' ? 7 : 1) * DAY_MS;
}

function keyOfMs(ms, groupBy) {
  const iso = new Date(ms).toISOString();
  return groupBy === 'month' ? iso.slice(0, 7) : iso.slice(0, 10);
}

function bucketKey(date, groupBy) {
  return keyOfMs(startOfBucketMs(date, groupBy), groupBy);
}

function buildBuckets(from, to, groupBy) {
  const keys = [];
  let ms = startOfBucketMs(from, groupBy);
  const end = startOfBucketMs(to, groupBy);
  let guard = 0;
  while (ms <= end && guard++ < 800) {
    keys.push(keyOfMs(ms, groupBy));
    ms = nextBucketMs(ms, groupBy);
  }
  return keys;
}

function pickGroupBy(from, to, requested) {
  const days = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / DAY_MS));
  if (requested === 'day') return days > 92 ? 'week' : 'day';
  if (requested === 'week') return days > 800 ? 'month' : 'week';
  if (requested === 'month') return 'month';
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

const PERIODS = ['30j', '90j', '6m', '12m', 'annee', 'custom'];

function resolveRange({ period = '6m', from, to }, now = new Date()) {
  if (period === 'custom') {
    const f = new Date(from); const t = new Date(to);
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime()) || f > t) return null;
    const start = unshift(startOfBucketMs(f, 'day'));
    const end = unshift(startOfBucketMs(t, 'day') + DAY_MS - 1);
    if (end - start > 366 * DAY_MS) return null;
    return { from: start, to: end };
  }
  const nowLocal = shifted(now);
  const y = nowLocal.getUTCFullYear(); const m = nowLocal.getUTCMonth(); const d = nowLocal.getUTCDate();
  const endMs = Date.UTC(y, m, d) + DAY_MS - 1;
  let startMs;
  if (period === '30j') startMs = Date.UTC(y, m, d) - 29 * DAY_MS;
  else if (period === '90j') startMs = Date.UTC(y, m, d) - 89 * DAY_MS;
  else if (period === '12m') startMs = Date.UTC(y, m - 11, 1);
  else if (period === 'annee') startMs = Date.UTC(y, 0, 1);
  else startMs = Date.UTC(y, m - 5, 1); // 6m par défaut
  return { from: unshift(startMs), to: unshift(endMs) };
}

const inRange = (date, range) => {
  const t = new Date(date).getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
};

function round(n) { return Math.round(n); }

function resteDe(invoice, paidByInvoice) {
  const { totalDu } = computeInvoiceTotals(invoice);
  const paye = num(paidByInvoice[String(invoice._id)]);
  return Math.max(0, totalDu - paye) * rateOf(invoice);
}

function breakdownFromMap(map, labels, { sortDesc = true, limit = null } = {}) {
  let items = Object.entries(map).map(([k, value]) => ({ label: labels[k] || k, value: round(value) }));
  if (sortDesc) items.sort((a, b) => b.value - a.value);
  if (limit && items.length > limit) {
    const rest = items.slice(limit).reduce((s, i) => s + i.value, 0);
    items = [...items.slice(0, limit), { label: 'Autres', value: rest }];
  }
  return items.filter((i) => i.value > 0);
}

/**
 * data = {
 *   invoices:  factures émises dans la période (lean),
 *   openInvoices: toutes les factures non soldées (pour l'ancienneté),
 *   payments:  paiements confirmés non remboursés de la période,
 *   expenses:  dépenses de la période,
 *   clients:   clients créés dans la période,
 *   quotes:    devis de la période,
 *   clientNames: { [id]: nom },
 *   paidByInvoice: { [invoiceId]: montant déjà payé },
 * }
 */
function computeAnalytics({ metrics, range, groupBy, data, now = new Date() }) {
  const keys = buildBuckets(range.from, range.to, groupBy);
  const index = Object.fromEntries(keys.map((k, i) => [k, i]));
  const zeros = () => keys.map(() => 0);
  const add = (arr, date, value) => {
    const i = index[bucketKey(date, groupBy)];
    if (i !== undefined) arr[i] += value;
  };

  const emitted = (data.invoices || []).filter((i) => !['brouillon', 'annulee'].includes(i.statut));
  const payments = data.payments || [];
  const paidByInvoice = data.paidByInvoice || {};

  const series = [];
  const breakdowns = [];

  for (const id of metrics) {
    const def = METRICS[id];
    if (!def) continue;

    if (def.kind === 'series') {
      const values = zeros();
      if (id === 'encaissements' || id === 'benefice') {
        payments.forEach((p) => add(values, p.date, paidAmountXOF(p)));
      }
      if (id === 'depenses' || id === 'benefice') {
        const sign = id === 'benefice' ? -1 : 1;
        (data.expenses || []).forEach((e) => add(values, e.date, sign * num(e.montant)));
      }
      if (id === 'factures_emises') emitted.forEach((i) => add(values, i.dateEmission, computeInvoiceTotals(i).totalXOF));
      if (id === 'impayes') {
        emitted.filter((i) => i.statut !== 'payee').forEach((i) => add(values, i.dateEmission, resteDe(i, paidByInvoice)));
      }
      if (id === 'nb_factures') emitted.forEach((i) => add(values, i.dateEmission, 1));
      if (id === 'nb_devis') (data.quotes || []).forEach((q) => add(values, q.dateEmission || q.createdAt, 1));
      if (id === 'commissions_affiliation') (data.commissionsAff || []).forEach((c) => add(values, c.createdAt, num(c.montant)));
      if (id === 'nouveaux_filleuls') (data.referrals || []).forEach((r) => add(values, r.createdAt, 1));
      if (id === 'nouveaux_clients') (data.clients || []).forEach((c) => add(values, c.createdAt, 1));
      const rounded = values.map(round);
      series.push({ id, label: def.label, unit: def.unit, values: rounded, total: rounded.reduce((s, v) => s + v, 0) });
      continue;
    }

    let items = [];
    if (id === 'repartition_statuts') {
      const map = {};
      (data.invoices || []).forEach((i) => { map[i.statut] = (map[i.statut] || 0) + 1; });
      items = breakdownFromMap(map, STATUT_FACTURE);
    } else if (id === 'repartition_methodes') {
      const map = {};
      payments.forEach((p) => { map[p.methode] = (map[p.methode] || 0) + paidAmountXOF(p); });
      items = breakdownFromMap(map, METHODE);
    } else if (id === 'depenses_categories') {
      const map = {};
      (data.expenses || []).forEach((e) => { map[e.categorie] = (map[e.categorie] || 0) + num(e.montant); });
      items = breakdownFromMap(map, CATEGORIE_DEPENSE);
    } else if (id === 'top_clients') {
      const map = {};
      (data.invoices || []).filter((i) => i.statut === 'payee').forEach((i) => {
        const name = (data.clientNames || {})[String(i.client)] || 'Client supprimé';
        map[name] = (map[name] || 0) + computeInvoiceTotals(i).totalXOF;
      });
      items = breakdownFromMap(map, {}, { limit: 7 });
    } else if (id === 'anciennete_creances') {
      const buckets = { a: 0, b: 0, c: 0, d: 0 };
      (data.openInvoices || []).forEach((i) => {
        const reste = resteDe(i, paidByInvoice);
        if (reste <= 0) return;
        const ech = i.dateEcheance ? new Date(i.dateEcheance).getTime() : null;
        if (ech === null || ech >= new Date(now).getTime()) { buckets.a += reste; return; }
        const jours = Math.floor((new Date(now).getTime() - ech) / DAY_MS);
        if (jours <= 30) buckets.b += reste; else if (jours <= 60) buckets.c += reste; else buckets.d += reste;
      });
      items = [
        { label: 'Pas encore échu', value: round(buckets.a) },
        { label: 'En retard de 1 à 30 jours', value: round(buckets.b) },
        { label: 'En retard de 31 à 60 jours', value: round(buckets.c) },
        { label: 'En retard de plus de 60 jours', value: round(buckets.d) },
      ].filter((i) => i.value > 0);
    } else if (id === 'statuts_devis') {
      const map = {};
      (data.quotes || []).forEach((q) => { map[q.statut] = (map[q.statut] || 0) + 1; });
      items = breakdownFromMap(map, STATUT_DEVIS);
    }
    breakdowns.push({ id, label: def.label, unit: def.unit, items, total: items.reduce((s, i) => s + i.value, 0) });
  }

  return { range: { from: range.from, to: range.to, groupBy }, buckets: keys, series, breakdowns };
}

function catalog(canSeeAdvanced) {
  return Object.entries(METRICS).map(([id, d]) => ({
    id, label: d.label, kind: d.kind, unit: d.unit, group: d.group, locked: d.pro && !canSeeAdvanced,
  }));
}

module.exports = {
  METRICS, PERIODS, CATEGORIE_DEPENSE,
  bucketKey, buildBuckets, pickGroupBy, resolveRange, inRange, computeAnalytics, catalog,
};
