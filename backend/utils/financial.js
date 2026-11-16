const mongoose = require('mongoose');
const PlatformSettings = require('../models/PlatformSettings');
const WalletEntry = require('../models/WalletEntry');
const Payment = require('../models/Payment');

function roundXof(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function payoutFeeForAmount(amount, brackets) {
  const a = roundXof(amount);
  const sorted = [...(brackets || [])].sort((x, y) => Number(x.seuilMax) - Number(y.seuilMax));
  const match = sorted.find((b) => a <= Number(b.seuilMax));
  return roundXof(match?.frais || 0);
}

function estimatePayinFee(grossAmount, percent) {
  return roundXof(grossAmount * (Number(percent || 0) / 100));
}

// Si le client prend les frais, le Pay-in étant calculé sur le montant total
// débité, on résout directement l'équation au lieu d'ajouter simplement un %.
function calculateClientCharge(invoiceAmount, payinPercent, payoutFee) {
  const base = roundXof(invoiceAmount);
  const payout = roundXof(payoutFee);
  const rate = Math.max(0, Number(payinPercent || 0) / 100);
  if (rate >= 1) throw new Error('Le taux de frais Pay-in doit être inférieur à 100 %.');
  return roundXof((base + payout) / (1 - rate));
}

async function getFinancialSettings() {
  return PlatformSettings.getOrCreate();
}

async function calculatePaymentQuote(invoiceAmount, fraisSupportesPar) {
  const settings = await getFinancialSettings();
  const rate = Number(settings.fedapayFeePercent || 0);
  // Le payout estimé est calculé sur le montant que l'utilisateur pourra
  // retirer. Le coût réel sera enregistré lors de la création du payout.
  const payoutEstimate = payoutFeeForAmount(invoiceAmount, settings.payoutFeeBrackets);
  if (fraisSupportesPar === 'client') {
    const totalClient = calculateClientCharge(invoiceAmount, rate, payoutEstimate);
    const payin = estimatePayinFee(totalClient, rate);
    return {
      montantFacture: baseRound(invoiceAmount),
      montantClientPaye: totalClient,
      fraisPayinEstimes: payin,
      fraisPayoutEstimes: payoutEstimate,
      fraisTransfertClient: Math.max(0, totalClient - invoiceAmount),
      montantNetEstimeUtilisateur: baseRound(invoiceAmount),
      tauxPayin: rate,
    };
  }

  const payin = estimatePayinFee(invoiceAmount, rate);
  return {
    montantFacture: baseRound(invoiceAmount),
    montantClientPaye: baseRound(invoiceAmount),
    fraisPayinEstimes: payin,
    fraisPayoutEstimes: payoutEstimate,
    fraisTransfertClient: 0,
    montantNetEstimeUtilisateur: Math.max(0, baseRound(invoiceAmount) - payin - payoutEstimate),
    tauxPayin: rate,
  };
}

function baseRound(value) { return Math.round(Number(value || 0)); }

const CREDIT_TYPES = ['credit_paiement', 'credit_ajustement', 'credit_affiliation', 'credit_annulation'];

// Solde brut : peut être NÉGATIF (ex. remboursement après un reversement déjà
// effectué). Il ne faut jamais le masquer : un solde négatif est une dette de
// l'utilisateur envers la plateforme et doit être visible côté admin.
async function getWalletBalanceRaw(ownerId) {
  const owner = ownerId instanceof mongoose.Types.ObjectId ? ownerId : new mongoose.Types.ObjectId(String(ownerId));
  const agg = await WalletEntry.aggregate([
    { $match: { owner } },
    { $group: { _id: '$type', total: { $sum: '$montant' } } },
  ]);
  let balance = 0;
  for (const row of agg) {
    if (CREDIT_TYPES.includes(row._id)) balance += row.total;
    else balance -= row.total;
  }
  return Math.round(balance);
}

// Solde retirable : jamais négatif.
async function getWalletBalance(ownerId) {
  return Math.max(0, await getWalletBalanceRaw(ownerId));
}

// Écrit une ligne de ledger AU PLUS UNE FOIS pour une clé donnée. Deux webhooks
// simultanés ne peuvent plus créditer deux fois : l'index unique sur dedupeKey
// départage, et le perdant récupère la ligne existante.
async function createLedgerEntryOnce(dedupeKey, fields) {
  const existing = await WalletEntry.findOne({ dedupeKey });
  if (existing) return { entry: existing, created: false };
  try {
    const entry = await WalletEntry.create({ ...fields, dedupeKey });
    return { entry, created: true };
  } catch (err) {
    if (err && err.code === 11000) {
      const entry = await WalletEntry.findOne({ dedupeKey });
      if (entry) return { entry, created: false };
    }
    throw err;
  }
}

async function createPaymentLedger({ payment, montantCredit, description }) {
  if (!montantCredit || montantCredit <= 0) return null;
  // Compatibilité : anciennes écritures créées avant l'introduction de dedupeKey.
  const legacy = await WalletEntry.findOne({ payment: payment._id, type: 'credit_paiement' });
  if (legacy) return legacy;
  const { entry } = await createLedgerEntryOnce(`credit_paiement:${payment._id}`, {
    owner: payment.owner,
    type: 'credit_paiement',
    montant: roundXof(montantCredit),
    payment: payment._id,
    reference: payment.fedapayTransactionId || String(payment._id),
    description: description || `Paiement de la facture ${payment.invoice}`,
    metadata: { origine: payment.origine, fraisSupportesPar: payment.fraisSupportesPar },
  });
  return entry;
}

async function allocatePayoutFeeToPayment(payment, actualFee) {
  const fee = roundXof(actualFee);
  if (!fee) return null;
  payment.fraisPayoutProvisionnes = fee;
  await payment.save();
  return fee;
}

module.exports = {
  roundXof,
  payoutFeeForAmount,
  estimatePayinFee,
  calculateClientCharge,
  calculatePaymentQuote,
  getWalletBalance,
  getWalletBalanceRaw,
  createLedgerEntryOnce,
  createPaymentLedger,
  allocatePayoutFeeToPayment,
};
