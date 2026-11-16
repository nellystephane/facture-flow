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

function computeInvoiceTotals(invoice) {
  const items = Array.isArray(invoice && invoice.items) ? invoice.items : [];
  const sousTotal = items.reduce((sum, item) => sum + num(item.quantite) * num(item.prixUnitaire), 0);
  const remise = num(invoice && invoice.remise);
  const totalHT = sousTotal - remise;
  const taxSpecific = items.reduce((sum, item) => sum + num(item.taxSpecific), 0);
  const montantTva = (totalHT * num(invoice && invoice.tva)) / 100;
  const totalTTCCalcule = totalHT + montantTva + taxSpecific;
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
    // Montant entier réellement exigible en FCFA (la devise n'a pas de centimes).
    totalDu: Math.max(0, Math.round(totalTTC)),
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
  sumPaid,
  isFullyPaid,
};
