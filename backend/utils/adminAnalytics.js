'use strict';

// Analyses de la plateforme (espace administrateur). Même principe que
// analyticsCore.js — logique pure, le contrôleur charge les données — mais
// avec des éléments propres à l'exploitation d'Oryxa.
const { buildBuckets, bucketKey } = require('./analyticsCore');

const ADMIN_METRICS = {
  nouveaux_comptes: { label: 'Nouveaux comptes', kind: 'series', unit: 'count', group: 'Croissance' },
  nouvelles_factures: { label: 'Factures créées par les utilisateurs', kind: 'series', unit: 'count', group: 'Croissance' },
  revenu_abonnements: { label: 'Revenu des abonnements', kind: 'series', unit: 'fcfa', group: 'Revenus' },
  abonnements_payes: { label: 'Abonnements payés', kind: 'series', unit: 'count', group: 'Revenus' },
  commissions_affiliation: { label: 'Commissions de parrainage versées', kind: 'series', unit: 'fcfa', group: 'Revenus' },
  volume_en_ligne: { label: 'Volume des paiements en ligne des utilisateurs', kind: 'series', unit: 'fcfa', group: 'Flux' },
  reversements: { label: 'Reversements envoyés', kind: 'series', unit: 'fcfa', group: 'Flux' },
  tickets_support: { label: 'Tickets de support', kind: 'series', unit: 'count', group: 'Support' },
  comptes_par_plan: { label: 'Comptes par plan', kind: 'breakdown', unit: 'count', group: 'Répartitions' },
  revenu_par_plan: { label: 'Revenu des abonnements par plan', kind: 'breakdown', unit: 'fcfa', group: 'Répartitions' },
  abonnements_par_duree: { label: 'Abonnements par durée choisie', kind: 'breakdown', unit: 'count', group: 'Répartitions' },
  reversements_par_statut: { label: 'Reversements par statut', kind: 'breakdown', unit: 'count', group: 'Répartitions' },
  tickets_par_statut: { label: 'Tickets par statut', kind: 'breakdown', unit: 'count', group: 'Répartitions' },
};

const PLAN = { gratuit: 'Gratuit', pro: 'Pro', business: 'Business' };
const DUREE = { '1mois': '1 mois', '6mois': '6 mois', '1an': '1 an' };
const PAYOUT = { pending: 'En attente', started: 'Démarré', processing: 'En cours', sent: 'Envoyé', failed: 'Échoué' };
const TICKET = { nouveau: 'Nouveau', en_cours: 'En cours', resolu: 'Résolu', ferme: 'Fermé' };

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function compter(rows, keyFn, labels, valueFn = () => 1) {
  const map = {};
  rows.forEach((r) => { const k = keyFn(r); map[k] = (map[k] || 0) + valueFn(r); });
  return Object.entries(map).map(([k, v]) => ({ label: labels[k] || k, value: Math.round(v) })).filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
}

function computeAdminAnalytics({ metrics, range, groupBy, data }) {
  const keys = buildBuckets(range.from, range.to, groupBy);
  const index = Object.fromEntries(keys.map((k, i) => [k, i]));
  const add = (arr, date, v) => { const i = index[bucketKey(date, groupBy)]; if (i !== undefined) arr[i] += v; };
  const series = [];
  const breakdowns = [];

  for (const id of metrics) {
    const def = ADMIN_METRICS[id];
    if (!def) continue;
    if (def.kind === 'series') {
      const values = keys.map(() => 0);
      if (id === 'nouveaux_comptes') (data.users || []).forEach((u) => add(values, u.createdAt, 1));
      if (id === 'nouvelles_factures') (data.invoices || []).forEach((i) => add(values, i.createdAt, 1));
      if (id === 'revenu_abonnements') (data.subscriptions || []).forEach((s) => add(values, s.createdAt, num(s.montant)));
      if (id === 'abonnements_payes') (data.subscriptions || []).forEach((s) => add(values, s.createdAt, 1));
      if (id === 'commissions_affiliation') (data.commissions || []).forEach((c) => add(values, c.createdAt, num(c.montant)));
      if (id === 'volume_en_ligne') (data.payments || []).forEach((p) => add(values, p.createdAt, num(p.montant)));
      if (id === 'reversements') (data.payouts || []).filter((p) => p.statut === 'sent').forEach((p) => add(values, p.createdAt, num(p.montantTransfere ?? p.montant)));
      if (id === 'tickets_support') (data.tickets || []).forEach((t) => add(values, t.createdAt, 1));
      const rounded = values.map(Math.round);
      series.push({ id, label: def.label, unit: def.unit, values: rounded, total: rounded.reduce((s, v) => s + v, 0) });
      continue;
    }
    let items = [];
    if (id === 'comptes_par_plan') items = compter(data.planCounts || [], (r) => r._id, PLAN, (r) => r.count);
    if (id === 'revenu_par_plan') items = compter(data.subscriptions || [], (s) => s.plan, PLAN, (s) => num(s.montant));
    if (id === 'abonnements_par_duree') items = compter(data.subscriptions || [], (s) => s.duree, DUREE);
    if (id === 'reversements_par_statut') items = compter(data.payouts || [], (p) => p.statut, PAYOUT);
    if (id === 'tickets_par_statut') items = compter(data.tickets || [], (t) => t.statut, TICKET);
    breakdowns.push({ id, label: def.label, unit: def.unit, items, total: items.reduce((s, i) => s + i.value, 0) });
  }
  return { range: { from: range.from, to: range.to, groupBy }, buckets: keys, series, breakdowns };
}

function adminCatalog() {
  return Object.entries(ADMIN_METRICS).map(([id, d]) => ({ id, label: d.label, kind: d.kind, unit: d.unit, group: d.group, locked: false }));
}

module.exports = { ADMIN_METRICS, computeAdminAnalytics, adminCatalog };
