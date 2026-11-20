const mongoose = require('mongoose');
const crypto = require('crypto');
const { computeInvoiceTotals } = require('../utils/invoiceTotals');

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantite: { type: Number, required: true, default: 1 },
  prixUnitaire: { type: Number, required: true, default: 0 },
  taxGroup: { type: String, enum: ['A', 'B', 'C', 'D', 'E', 'F'], default: null },
  taxRate: { type: Number, min: 0, max: 100, default: null },
  taxSpecific: { type: Number, min: 0, default: 0 },
  originalPrice: { type: Number, min: 0, default: null },
  priceModification: { type: String, default: '' },
  // Produit du catalogue (optionnel) : permet de faire baisser son stock.
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
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
  modeFacturation: { type: String, enum: ['commerciale', 'normalisee'], default: 'commerciale' },
  stockApplique: { type: Boolean, default: false },
  // Devise du document. Les anciens documents n'ont pas ce champ : XOF.
  devise: { type: String, default: 'XOF' },
  // XOF pour 1 unité de `devise`, figé à l'émission (1 en XOF).
  tauxChange: { type: Number, default: 1, min: 0 },
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
  // État e-MECeF distinct du statut commercial Oryxa. Ne jamais confondre les deux.
  fiscalisation: {
    status: { type: String, enum: ['non_emise', 'submitting', 'pending_confirmation', 'confirming', 'cancelling', 'confirmed', 'cancelled', 'error', 'unknown'], default: 'non_emise' },
    environment: { type: String, enum: ['test'], default: 'test' },
    invoiceType: { type: String, enum: ['FV', 'FA', 'EV', 'EA'], default: 'FV' },
    aib: { type: String, enum: ['', 'A', 'B'], default: '' },
    reference: { type: String, default: null },
    requestPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    creationResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    uid: { type: String, default: null },
    requestFingerprint: { type: String, default: null },
    requestAt: { type: Date, default: null },
    expectedTotal: { type: Number, default: null },
    dgiTotal: { type: Number, default: null },
    confirmedAt: { type: Date, default: null },
    codeMECeFDGI: { type: String, default: null },
    nim: { type: String, default: null },
    dateTime: { type: String, default: null },
    qrCode: { type: String, default: null },
    counters: { type: String, default: null },
    response: { type: mongoose.Schema.Types.Mixed, default: null },
    errorCode: { type: String, default: null },
    errorDesc: { type: String, default: null },
    // Trace des réinitialisations manuelles (après vérification auprès de la DGI).
    resetHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
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

// Les montants viennent d'un module unique (utils/invoiceTotals) pour que la
// page publique, le paiement, le webhook, les stats et le PDF ne divergent
// jamais. `totalTTC` fait foi du total fiscal DGI une fois la facture confirmée.
invoiceSchema.virtual('totalHT').get(function () {
  return computeInvoiceTotals(this).totalHT;
});

invoiceSchema.virtual('totalTTC').get(function () {
  return computeInvoiceTotals(this).totalTTC;
});

invoiceSchema.pre('save', function () {
  if (!this.publicToken) {
    this.publicToken = crypto.randomBytes(20).toString('hex');
  }
});

module.exports = mongoose.model('Invoice', invoiceSchema);
