'use strict';

const Payment = require('../models/Payment');
const WalletEntry = require('../models/WalletEntry');
const { createLedgerEntryOnce, roundXof } = require('./financial');
const { syncInvoiceStatus } = require('./invoicePayments');

// Enregistre le remboursement d'un paiement en ligne. Utilisé à la fois par le
// webhook FedaPay et par le bouton admin : les deux doivent produire le même
// effet (ligne de ledger + statut de la facture), sinon le solde retirable de
// l'utilisateur reste gonflé d'un paiement remboursé.
// Idempotent : la prise en charge est atomique, la ligne de ledger a une clé unique.
async function applyRefund(filter) {
  const claimed = await Payment.findOneAndUpdate(
    { ...filter, statut: 'complete', rembourse: { $ne: true } },
    { $set: { rembourse: true, rembourseLe: new Date() } },
    { returnDocument: 'after' }
  );
  // Reprise après crash : le paiement est déjà marqué remboursé mais l'écriture
  // de ledger a pu ne jamais être faite. Elle est idempotente : on la rejoue.
  const payment = claimed || (await Payment.findOne({ ...filter, statut: 'complete', rembourse: true }));
  if (!payment) return null;

  // Ce qui avait été crédité au ledger est annulé à l'identique, moins une
  // éventuelle provision de frais de reversement posée par l'ancien webhook.
  const credit = await WalletEntry.findOne({ payment: payment._id, type: 'credit_paiement' });
  const legacyReserve = await WalletEntry.findOne({ payment: payment._id, type: 'debit_frais', 'metadata.kind': 'payout_reserve' });
  const base = credit ? credit.montant : (payment.montantNetUtilisateur || payment.montantFacture || payment.montant);
  const montant = roundXof(base - (credit && legacyReserve ? legacyReserve.montant : 0));
  if (montant > 0) {
    const legacy = await WalletEntry.findOne({ payment: payment._id, type: 'debit_remboursement' });
    if (!legacy) {
      await createLedgerEntryOnce(`refund:${payment._id}`, {
        owner: payment.owner,
        type: 'debit_remboursement',
        montant,
        payment: payment._id,
        reference: `refund-${payment._id}`,
        description: 'Remboursement confirmé',
      });
    }
  }
  // La facture n'est plus entièrement payée : on recalcule son statut.
  await syncInvoiceStatus(payment.invoice);
  return claimed;
}

module.exports = { applyRefund };
