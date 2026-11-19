'use strict';

const { computeInvoiceTotals, rateOf } = require('./invoiceTotals');

const DAY_MS = 86400000;

// Synthèse commerciale d'un client à partir de ses factures et paiements.
// Logique pure : le contrôleur charge les données.
function summarizeClient({ invoices, payments, now = new Date() }) {
  const actives = invoices.filter((i) => !['brouillon', 'annulee'].includes(i.statut));
  const paidByInvoice = {};
  const lastPaymentByInvoice = {};
  payments.forEach((p) => {
    const key = String(p.invoice);
    paidByInvoice[key] = (paidByInvoice[key] || 0) + Number(p.montantFacture ?? p.montant ?? 0);
    const t = new Date(p.date).getTime();
    if (!lastPaymentByInvoice[key] || t > lastPaymentByInvoice[key]) lastPaymentByInvoice[key] = t;
  });

  let totalFacture = 0; let totalPaye = 0; let totalReste = 0; let enRetard = 0;
  let delaiTotal = 0; let delaiN = 0; let aTemps = 0; let soldees = 0;
  const lignes = actives.map((inv) => {
    const { totalDu } = computeInvoiceTotals(inv);
    const paye = Math.min(totalDu, paidByInvoice[String(inv._id)] || 0);
    const reste = inv.statut === 'payee' ? 0 : Math.max(0, totalDu - paye);
    const taux = rateOf(inv);
    totalFacture += totalDu * taux; totalPaye += paye * taux; totalReste += reste * taux;
    const echu = inv.dateEcheance && new Date(inv.dateEcheance).getTime() < new Date(now).getTime();
    if (reste > 0 && echu) enRetard += 1;
    if (inv.statut === 'payee') {
      soldees += 1;
      const dernier = lastPaymentByInvoice[String(inv._id)];
      if (dernier) {
        delaiTotal += Math.max(0, Math.round((dernier - new Date(inv.dateEmission).getTime()) / DAY_MS));
        delaiN += 1;
        if (!inv.dateEcheance || dernier <= new Date(inv.dateEcheance).getTime() + DAY_MS) aTemps += 1;
      }
    }
    return { _id: inv._id, numero: inv.numero, statut: inv.statut, dateEmission: inv.dateEmission, dateEcheance: inv.dateEcheance, devise: inv.devise || 'XOF', totalDu, paye, reste };
  });

  const delaiMoyenJours = delaiN ? Math.round(delaiTotal / delaiN) : null;
  const tauxPonctualite = delaiN ? Math.round((aTemps / delaiN) * 100) : null;
  // Repère simple et lisible, basé uniquement sur l'historique de paiement.
  let fiabilite = 'nouveau';
  if (delaiN >= 2 || enRetard > 0) {
    if (enRetard >= 2 || (tauxPonctualite !== null && tauxPonctualite < 50)) fiabilite = 'a_surveiller';
    else if (enRetard === 1 || (tauxPonctualite !== null && tauxPonctualite < 80)) fiabilite = 'moyenne';
    else fiabilite = 'bonne';
  }

  return {
    nombreFactures: actives.length,
    nombreSoldees: soldees,
    totalFacture: Math.round(totalFacture),
    totalPaye: Math.round(totalPaye),
    totalReste: Math.round(totalReste),
    nombreEnRetard: enRetard,
    delaiMoyenJours,
    tauxPonctualite,
    fiabilite,
    lignes,
  };
}

module.exports = { summarizeClient };
