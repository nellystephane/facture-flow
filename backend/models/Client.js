const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nom: { type: String, required: true, trim: true },
  entreprise: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  telephone: { type: String, default: '' },
  adresse: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
