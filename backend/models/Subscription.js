const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['pro', 'business'], required: true },
  duree: { type: String, enum: ['6mois', '1an'], required: true },
  montant: { type: Number, required: true },
  statut: { type: String, enum: ['en_attente', 'payee', 'echouee'], default: 'en_attente' },
  fedapayTransactionId: { type: String, default: null, index: true },
  dateDebut: { type: Date, default: null },
  dateFin: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
