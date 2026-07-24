const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  entreprise: { type: String, trim: true, default: '' },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  telephone: { type: String, default: '' },
  adresse: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  devise: { type: String, default: 'FCFA' },
  subscription: { type: String, enum: ['gratuit', 'pro', 'business'], default: 'gratuit' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
