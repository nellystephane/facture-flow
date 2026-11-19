const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nom: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  prix: { type: Number, required: true, default: 0 },
  unite: { type: String, default: 'unité' },
  // Suivi de stock (optionnel, réservé aux plans qui l'incluent).
  suiviStock: { type: Boolean, default: false },
  stock: { type: Number, default: 0 },
  seuilAlerte: { type: Number, min: 0, default: 0 },
  prixAchat: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
