const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const WalletEntry = require('../models/WalletEntry');

// Remplace les anciens index uniques « sparse » sur fedapayTransactionId (qui
// traitent un `null` explicite comme une vraie valeur : deux paiements manuels
// pouvaient entrer en collision) par des index partiels, et crée l'index
// d'idempotence du ledger. Sans danger si relancé.
async function fixFedapayIndex(Model, label) {
  const indexes = await Model.collection.indexes();
  for (const index of indexes) {
    if (index.key && index.key.fedapayTransactionId === 1 && index.name !== 'uniq_fedapayTransactionId') {
      await Model.collection.dropIndex(index.name);
      console.log(`[migration] ${label}: ancien index ${index.name} supprimé`);
    }
  }
  // Les `null` explicites deviennent des champs absents.
  await Model.collection.updateMany({ fedapayTransactionId: null }, { $unset: { fedapayTransactionId: '' } });
  await Model.collection.createIndex(
    { fedapayTransactionId: 1 },
    { name: 'uniq_fedapayTransactionId', unique: true, partialFilterExpression: { fedapayTransactionId: { $type: 'string' } } }
  );
}

// Les reversements créés avant l'introduction de startRequestedAt ont déjà
// été démarrés chez FedaPay : sans cette valeur ils seraient pris pour des
// reversements « jamais démarrés » et leur solde serait rendu à tort.
async function backfillPayoutStart() {
  const Payout = require('../models/Payout');
  const res = await Payout.collection.updateMany(
    { fedapayPayoutId: { $nin: [null, ''] }, startRequestedAt: null, statut: { $ne: 'failed' } },
    [{ $set: { startRequestedAt: '$createdAt' } }]
  );
  if (res.modifiedCount) console.log(`[migration] ${res.modifiedCount} reversement(s) existant(s) marqué(s) comme démarrés`);
}

async function migrateFinancialIndexes() {
  await backfillPayoutStart();
  await fixFedapayIndex(Payment, 'Payment');
  await fixFedapayIndex(Subscription, 'Subscription');
  await WalletEntry.collection.createIndex(
    { dedupeKey: 1 },
    { name: 'uniq_dedupeKey', unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }
  );
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI manquant.');
  await mongoose.connect(process.env.MONGO_URI);
  await migrateFinancialIndexes();
  await mongoose.disconnect();
  console.log('[migration] Indexes financiers corrigés.');
}

if (require.main === module) {
  main().catch((err) => { console.error('[migration] Échec :', err); process.exit(1); });
}

module.exports = { migrateFinancialIndexes };
