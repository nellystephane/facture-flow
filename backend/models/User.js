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
  // Coordonnées bancaires affichées sur les factures pour le paiement par virement
  banque: {
    nomBanque: { type: String, default: '' },
    titulaire: { type: String, default: '' },
    iban: { type: String, default: '' },
    rib: { type: String, default: '' },
    swift: { type: String, default: '' },
  },
  subscription: { type: String, enum: ['gratuit', 'pro', 'business'], default: 'gratuit' },
  abonnement: {
    duree: { type: String, enum: [null, '6mois', '1an'], default: null },
    dateDebut: { type: Date, default: null },
    dateFin: { type: Date, default: null },
  },
}, { timestamps: true });

// Un compte est "premium" tant que son abonnement payant (pro/business) n'a pas expiré.
userSchema.virtual('estPremium').get(function () {
  if (this.subscription === 'gratuit') return false;
  if (!this.abonnement || !this.abonnement.dateFin) return true; // legacy / sans date de fin
  return new Date(this.abonnement.dateFin) > new Date();
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
