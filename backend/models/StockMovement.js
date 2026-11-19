const mongoose = require('mongoose');

// Journal des mouvements de stock : chaque variation de quantité d'un produit
// y est inscrite (entrée, sortie, correction, facture, annulation) pour que le
// stock affiché reste explicable.
const stockMovementSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  type: { type: String, enum: ['entree', 'sortie', 'ajustement', 'facture', 'annulation'], required: true },
  quantite: { type: Number, required: true }, // signée : + entre, − sort
  stockApres: { type: Number, required: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  note: { type: String, default: '' },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

stockMovementSchema.index({ owner: 1, service: 1, date: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
