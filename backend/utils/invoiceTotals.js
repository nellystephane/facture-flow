'use strict';

// ============================================================================
// Source UNIQUE des montants d'une facture.
//
// Avant ce module, la formule du TTC était recopiée dans cinq contrôleurs et
// quatre d'entre elles ignoraient la taxe spécifique e-MECeF. Résultat : une
// facture avec taxe spécifique pouvait être marquée « payée » alors qu'il
// manquait la taxe, et la page publique affichait un total différent du PDF.
//
// Toute lecture du total d'une facture (page publique, paiement, webhook,
// statistiques, relances) doit passer par ce module.
// ============================================================================

// Un paiement compte pour la facture s'il est confirmé ET non remboursé.
const { roundMoney, normalizeDevise } = require('./currency');

const PAID_PAYMENT_FILTER = Object.freeze({ statut: 'complete', rembourse: { $ne: true } });

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Quand la DGI a confirmé le document fiscal, son total fait foi : c'est lui
// qui est légalement dû par le client (le prix unitaire TTC est arrondi par
// ligne côté DGI, ce qui peut différer de quelques FCFA du calcul HT global).
function fiscalTotalOf(invoice) {
  const f = invoice && invoice.fiscalisation;
  if (!f || f.status !== 'confirmed') return null;
  if (f.dgiTotal === null || f.dgiTotal === undefined || f.dgiTotal === '') return null;
  const total = Number(f.dgiTotal);
  return Number.isFinite(total) && total >= 0 ? total : null;
}

// Facteur de conversion vers le FCFA (1 pour une facture en XOF ou sans devise).
function rateOf(doc) {
  if (!doc || normalizeDevise(doc.devise) === 'XOF') return 1;
  const t = Number(doc.tauxChange);
  return Number.isFinite(t) && t > 0 ? t : 1;
}

function computeInvoiceTotals(invoice) {
  const items = Array.isArray(invoice && invoice.items) ? invoice.items : [];
  const sousTotal = items.reduce((sum, item) => sum + num(item.quantite) * num(item.prixUnitaire), 0);
  const remise = num(invoice && invoice.remise);
  const totalHT = sousTotal - remise;
  const taxSpecific = items.reduce((sum, item) => sum + num(item.taxSpecific), 0);
  // En mode normalisé, la TVA est calculée ligne par ligne selon le taux
  // DGI enregistré avec le groupe fiscal de chaque article. Le mode commercial
  // conserve strictement le calcul historique à taux global.
  const montantTva = invoice && invoice.modeFacturation === 'normalisee'
    ? items.reduce((sum, item) => {
      const base = num(item.quantite) * num(item.prixUnitaire);
      const apiGross = Math.round(Math.round(num(item.prixUnitaire) * (1 + num(item.taxRate) / 100)) * num(item.quantite));
      return sum + (apiGross - base);
    }, 0)
    : (totalHT * num(invoice && invoice.tva)) / 100;
  const totalTTCCalcule = invoice && invoice.modeFacturation === 'normalisee'
    ? items.reduce((sum, item) => sum + Math.round(Math.round(num(item.prixUnitaire) * (1 + num(item.taxRate) / 100)) * num(item.quantite)), 0) + taxSpecific - remise
    : totalHT + montantTva + taxSpecific;
  const fiscalTotal = fiscalTotalOf(invoice);
  const totalTTC = fiscalTotal !== null ? fiscalTotal : totalTTCCalcule;
  return {
    sousTotal,
    remise,
    totalHT,
    montantTva,
    taxSpecific,
    totalTTCCalcule,
    fiscalTotal,
    totalTTC,
    // Montant réellement exigible, arrondi selon la devise (entier en XOF, centimes sinon).
    totalDu: Math.max(0, roundMoney(totalTTC, invoice && invoice.devise)),
    // Équivalent FCFA au taux figé du document : sert aux statistiques uniquement.
    totalXOF: totalTTC * rateOf(invoice),
  };
}

// Montant imputé à la facture par un paiement. Avec « frais à la charge du
// client », `montant` contient les frais de transfert : seul `montantFacture`
// diminue la dette.
function paidAmountOf(payment) {
  if (!payment) return 0;
  if (payment.montantFacture !== null && payment.montantFacture !== undefined) return num(payment.montantFacture);
  return num(payment.montant);
}

// Montant imputé converti en FCFA (taux du paiement, copié de la facture).
function paidAmountXOF(payment) {
  return paidAmountOf(payment) * rateOf(payment);
}

function sumPaidXOF(payments) {
  return (payments || [])
    .filter((p) => p && p.statut === 'complete' && !p.rembourse)
    .reduce((sum, p) => sum + paidAmountXOF(p), 0);
}

function sumPaid(payments) {
  return (payments || [])
    .filter((p) => p && p.statut === 'complete' && !p.rembourse)
    .reduce((sum, p) => sum + paidAmountOf(p), 0);
}

function isFullyPaid(totalPaye, totalDu) {
  return totalDu > 0 ? totalPaye >= totalDu : false;
}

module.exports = {
  PAID_PAYMENT_FILTER,
  computeInvoiceTotals,
  fiscalTotalOf,
  paidAmountOf,
  paidAmountXOF,
  rateOf,
  sumPaid,
  sumPaidXOF,
  isFullyPaid,
};
