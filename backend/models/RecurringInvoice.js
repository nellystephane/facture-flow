const mongoose = require('mongoose');

const recurringItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantite: { type: Number, required: true, default: 1 },
  prixUnitaire: { type: Number, required: true, default: 0 },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
}, { _id: false });

// Modèle de facture récurrente : un job quotidien en crée une vraie facture
// (numérotation normale) chaque fois que `prochaineEmission` est atteinte.
const recurringInvoiceSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  titre: { type: String, required: true, trim: true },
  objet: { type: String, default: '' },
  items: { type: [recurringItemSchema], validate: (v) => v.length > 0 },
  devise: { type: String, default: 'XOF' },
  tauxChange: { type: Number, default: 1, min: 0 },
  remise: { type: Number, default: 0 },
  tva: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  fraisSupportesPar: { type: String, enum: ['utilisateur', 'client'], default: 'utilisateur' },
  frequence: { type: String, enum: ['hebdomadaire', 'mensuelle', 'trimestrielle', 'annuelle'], required: true },
  jourAncre: { type: Number, min: 1, max: 31, default: 1 }, // jour du mois voulu (évite la dérive 31 -> 28 -> 28)
  prochaineEmission: { type: Date, required: true },
  dateFin: { type: Date, default: null },
  delaiEcheanceJours: { type: Number, min: 0, max: 365, default: 15 },
  envoiAutomatique: { type: Boolean, default: false },
  actif: { type: Boolean, default: true },
  nombreGenerees: { type: Number, default: 0 },
  derniereGeneration: { type: Date, default: null },
  derniereErreur: { type: String, default: '' },
}, { timestamps: true });

recurringInvoiceSchema.index({ actif: 1, prochaineEmission: 1 });
recurringInvoiceSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('RecurringInvoice', recurringInvoiceSchema);
