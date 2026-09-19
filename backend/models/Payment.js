const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  montant: { type: Number, required: true },
  // Montant commercial réellement imputé à la facture. Pour un paiement en ligne
  // avec frais client, `montant` peut être supérieur à ce montant.
  montantFacture: { type: Number, default: null },
  montantClientPaye: { type: Number, default: null },
  fraisPayin: { type: Number, default: 0 },
  fraisPayoutProvisionnes: { type: Number, default: 0 },
  fraisSupportesPar: { type: String, enum: ['utilisateur', 'client'], default: 'utilisateur' },
  montantNetUtilisateur: { type: Number, default: null },
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
  fedapayTransactionId: { type: String, default: null, index: true, unique: true, sparse: true },
  fedapayMode: { type: String, default: '' }, // mtn, moov, carte bancaire, etc.
  receiptNumber: { type: String, default: '' }, // Numéro de reçu, ex: REC-2026-0001
  // Suivi litige/remboursement — géré depuis la page admin (voir
  // controllers/adminController.js), jamais par l'entrepreneur lui-même.
  litige: { type: Boolean, default: false },
  litigeNote: { type: String, default: '' },
  rembourse: { type: Boolean, default: false },
  rembourseLe: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
