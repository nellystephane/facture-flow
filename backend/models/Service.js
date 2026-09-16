const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nom: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  prix: { type: Number, required: true, default: 0 },
  unite: { type: String, default: 'unité' },
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
