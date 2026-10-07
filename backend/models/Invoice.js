const mongoose = require('mongoose');
const crypto = require('crypto');

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantite: { type: Number, required: true, default: 1 },
  prixUnitaire: { type: Number, required: true, default: 0 },
}, { _id: false });

itemSchema.virtual('total').get(function () {
  return (this.quantite || 0) * (this.prixUnitaire || 0);
});

const invoiceSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  numero: { type: String, required: true },
  objet: { type: String, default: '' },
  dateEmission: { type: Date, default: Date.now },
  dateEcheance: { type: Date },
  items: [itemSchema],
  remise: { type: Number, default: 0 },
  tva: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  // Qui supporte les frais liés au paiement en ligne et au reversement.
  // 'utilisateur' conserve le comportement historique : le client paie le TTC.
  fraisSupportesPar: { type: String, enum: ['utilisateur', 'client'], default: 'utilisateur' },
  statut: {
    type: String,
    enum: ['brouillon', 'envoyee', 'vue', 'payee', 'en_retard', 'annulee'],
    default: 'brouillon'
  },
  template: { type: String, enum: ['classique', 'moderne', 'minimal', 'atelier', 'horizon', 'prestige', 'corporate', 'signature', 'noir'], default: 'classique' },
  quote: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', default: null },
  // Jeton public : permet au client d'accéder à la page de paiement sans compte.
  publicToken: { type: String, default: null },
  publicAccessRevoked: { type: Boolean, default: false },
  derniereRelance: { type: Date, default: null },
  dateEnvoi: { type: Date, default: null },
  dateVue: { type: Date, default: null },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Une facture peut être créée sans devis. L'unicité ne doit s'appliquer
// qu'aux factures réellement liées à un devis : un index unique classique
// sur `quote` provoquerait E11000 dès la deuxième valeur null.
invoiceSchema.index(
  { quote: 1 },
  { unique: true, partialFilterExpression: { quote: { $type: 'objectId' } } }
);

// Même principe pour le lien public : on n'indexe que les tokens réellement
// présents afin d'éviter les collisions sur des valeurs null explicites.
invoiceSchema.index(
  { publicToken: 1 },
  { unique: true, partialFilterExpression: { publicToken: { $type: 'string' } } }
);

invoiceSchema.virtual('totalHT').get(function () {
  const sousTotal = (this.items || []).reduce((s, i) => s + (i.quantite || 0) * (i.prixUnitaire || 0), 0);
  return sousTotal - (this.remise || 0);
});

invoiceSchema.virtual('totalTTC').get(function () {
  return this.totalHT * (1 + (this.tva || 0) / 100);
});

invoiceSchema.pre('save', function () {
  if (!this.publicToken) {
    this.publicToken = crypto.randomBytes(20).toString('hex');
  }
});

module.exports = mongoose.model('Invoice', invoiceSchema);
