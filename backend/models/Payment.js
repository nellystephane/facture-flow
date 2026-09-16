const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  montant: { type: Number, required: true },
  methode: {
    type: String,
    enum: ['especes', 'mtn_money', 'moov_money', 'carte', 'virement', 'autre'],
    default: 'especes'
  },
  // 'manuel' = saisi par l'entrepreneur (ex: cash remis en main propre)
  // 'en_ligne' = payé par le client via la page de paiement FedaPay
  origine: { type: String, enum: ['manuel', 'en_ligne'], default: 'manuel' },
  statut: { type: String, enum: ['en_attente', 'complete', 'echoue'], default: 'complete' },
  date: { type: Date, default: Date.now },
  reference: { type: String, default: '' },
  note: { type: String, default: '' },
  // Traçabilité FedaPay (paiements en ligne uniquement)
  fedapayTransactionId: { type: String, default: null, index: true },
  fedapayMode: { type: String, default: '' }, // mtn, moov, carte bancaire, etc.
  receiptNumber: { type: String, default: '' }, // Numéro de reçu, ex: REC-2026-0001
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
