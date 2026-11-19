const mongoose = require('mongoose');

const CATEGORIES = ['loyer', 'transport', 'materiel', 'marketing', 'salaires', 'fournitures', 'internet_telephone', 'taxes', 'autre'];

const expenseSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  libelle: { type: String, required: true, trim: true },
  montant: { type: Number, required: true, min: 0 },
  categorie: { type: String, enum: CATEGORIES, default: 'autre' },
  date: { type: Date, default: Date.now },
  fournisseur: { type: String, default: '', trim: true },
  methode: { type: String, enum: ['especes', 'mtn_money', 'moov_money', 'carte', 'virement', 'autre'], default: 'especes' },
  note: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

expenseSchema.index({ owner: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
module.exports.CATEGORIES = CATEGORIES;
