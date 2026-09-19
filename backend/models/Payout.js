const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  montant: { type: Number, required: true },
  devise: { type: String, default: 'XOF' },
  mode: { type: String, enum: ['mobile_money', 'bank_transfer'], required: true },
  destination: {
    provider: { type: String, default: '' },
    phone: { type: String, default: '' },
    country: { type: String, default: 'BJ' },
    bank: { type: String, default: '' },
  },
  statut: { type: String, enum: ['pending', 'started', 'processing', 'sent', 'failed'], default: 'pending', index: true },
  fedapayPayoutId: { type: String, default: null, index: true },
  fedapayReference: { type: String, default: '' },
  fedapayStatus: { type: String, default: '' },
  fraisFedaPay: { type: Number, default: 0 },
  commissionFedaPay: { type: Number, default: 0 },
  montantTransfere: { type: Number, default: 0 },
  montantDebite: { type: Number, default: 0 },
  reserveFrais: { type: Number, default: 0 },
  erreur: { type: String, default: '' },
  tentatives: { type: Number, default: 0 },
  idempotencyKey: { type: String, required: true, unique: true },
  sourcePayments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
  scheduledAt: { type: Date, default: null },
  sentAt: { type: Date, default: null },
  failedAt: { type: Date, default: null },
}, { timestamps: true });

payoutSchema.index({ owner: 1, createdAt: -1 });
// Verrou distribué : un seul payout non terminé par espace, même si deux
// workers/instances lancent le job simultanément.
payoutSchema.index(
  { owner: 1 },
  { unique: true, partialFilterExpression: { statut: { $in: ['pending', 'started', 'processing'] } } }
);

module.exports = mongoose.model('Payout', payoutSchema);
