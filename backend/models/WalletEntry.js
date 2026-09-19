const mongoose = require('mongoose');

// Ledger immuable des mouvements financiers internes Oryxa. Ce modèle ne
// représente jamais l'argent détenu en banque : il représente uniquement la
// créance/somme retirable attribuée à un utilisateur Oryxa et son historique.
const walletEntrySchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['credit_paiement', 'debit_frais', 'debit_remboursement', 'credit_ajustement', 'debit_reversement', 'credit_annulation'], required: true },
  montant: { type: Number, required: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null, index: true },
  payout: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout', default: null, index: true },
  reference: { type: String, default: '' },
  description: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

walletEntrySchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('WalletEntry', walletEntrySchema);
