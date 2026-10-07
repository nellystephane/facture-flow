const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');

/**
 * Repairs legacy unique indexes created before the invoice indexes became
 * partial. Safe to run repeatedly: existing correct indexes are preserved.
 */
async function migrateInvoiceIndexes() {
  const indexes = await Invoice.collection.indexes();

  for (const index of indexes) {
    const isQuoteIndex = index.key && index.key.quote === 1;
    const isPublicTokenIndex = index.key && index.key.publicToken === 1;

    if (isQuoteIndex && index.unique && !index.partialFilterExpression) {
      await Invoice.collection.dropIndex(index.name);
      console.log(`[migration] Ancien index facture supprimé : ${index.name}`);
    }

    if (isPublicTokenIndex && index.unique && !index.partialFilterExpression) {
      await Invoice.collection.dropIndex(index.name);
      console.log(`[migration] Ancien index publicToken supprimé : ${index.name}`);
    }
  }

  await Invoice.collection.createIndex(
    { quote: 1 },
    { name: 'quote_1', unique: true, partialFilterExpression: { quote: { $type: 'objectId' } } }
  );
  await Invoice.collection.createIndex(
    { publicToken: 1 },
    { name: 'publicToken_1', unique: true, partialFilterExpression: { publicToken: { $type: 'string' } } }
  );
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI manquant.');
  await mongoose.connect(process.env.MONGO_URI);
  await migrateInvoiceIndexes();
  await mongoose.disconnect();
  console.log('[migration] Indexes Invoice corrigés.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[migration] Échec :', err);
    process.exit(1);
  });
}

module.exports = { migrateInvoiceIndexes };
