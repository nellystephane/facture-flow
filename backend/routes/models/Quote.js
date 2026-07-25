const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantite: { type: Number, required: true, default: 1 },
  prixUnitaire: { type: Number, required: true, default: 0 },
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  numero: { type: String, required: true },
  objet: { type: String, default: '' },
  dateEmission: { type: Date, default: Date.now },
  dateExpiration: { type: Date },
  items: [itemSchema],
  remise: { type: Number, default: 0 },
  tva: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  statut: {
    type: String,
    enum: ['brouillon', 'envoye', 'accepte', 'refuse', 'expire'],
    default: 'brouillon'
  },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

quoteSchema.virtual('totalHT').get(function () {
  const sousTotal = (this.items || []).reduce((s, i) => s + (i.quantite || 0) * (i.prixUnitaire || 0), 0);
  return sousTotal - (this.remise || 0);
});

quoteSchema.virtual('totalTTC').get(function () {
  return this.totalHT * (1 + (this.tva || 0) / 100);
});

module.exports = mongoose.model('Quote', quoteSchema);
