const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  entreprise: { type: String, trim: true, default: '' },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  telephone: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
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
  // Destination des reversements Oryxa. Les coordonnées sont utilisées uniquement
  // lorsque le compte est explicitement activé par son propriétaire.
  payoutSettings: {
    // Destination de reversement réellement autorisée par FedaPay.
    // `pending` signifie que la nouvelle destination attend la confirmation
    // envoyée à l'adresse email du compte Oryxa.
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ['mobile_money', 'bank_transfer'], default: 'mobile_money' },
    provider: { type: String, default: 'mtn' },
    phone: { type: String, default: '' },
    country: { type: String, default: 'BJ' },
    titulaire: { type: String, default: '' },
    bank: { type: String, default: '' },
    iban: { type: String, default: '' },
    rib: { type: String, default: '' },
    schedule: { type: String, enum: ['weekly', 'monthly'], default: 'weekly' },
    status: { type: String, enum: ['pending', 'active', 'disabled'], default: 'disabled' },
    emailConfirmed: { type: Boolean, default: false },
    confirmationTokenHash: { type: String, default: null, select: false },
    confirmationTokenExpire: { type: Date, default: null, select: false },
    confirmedAt: { type: Date, default: null },
  },
  subscription: { type: String, enum: ['gratuit', 'pro', 'business'], default: 'gratuit' },
  // Vérification d'email à l'inscription : code à 6 chiffres, valable 15 minutes.
  emailVerifie: { type: Boolean, default: false },
  codeVerification: { type: String, default: null, select: false },
  codeVerificationExpire: { type: Date, default: null, select: false },
  // Mot de passe oublié : même mécanique (code à 6 chiffres par email).
  codeResetPassword: { type: String, default: null, select: false },
  codeResetPasswordExpire: { type: Date, default: null, select: false },
  abonnement: {
    duree: { type: String, enum: [null, '1mois', '6mois', '1an'], default: null },
    dateDebut: { type: Date, default: null },
    dateFin: { type: Date, default: null },
  },
  // ===== Multi-utilisateurs (plan Business) =====
  // `compteProprietaire` : si défini, ce compte est un COLLABORATEUR qui
  // travaille dans l'espace d'un autre utilisateur (le "propriétaire") — ses
  // clients/factures/devis/paiements sont ceux du propriétaire, pas les
  // siens propres. Un compte sans `compteProprietaire` est propriétaire de
  // son propre espace (le cas normal, y compris pour les plans Gratuit/Pro).
  // Voir middleware/auth.js qui résout `req.userId` vers le bon espace de
  // travail à chaque requête.
  compteProprietaire: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  role: { type: String, enum: ['proprietaire', 'admin', 'collaborateur'], default: 'proprietaire' },
  // Suspension par un admin PLATEFORME (voir middleware/adminAuth.js) — à ne
  // pas confondre avec le champ `role` ci-dessus, qui décrit un rôle
  // D'ÉQUIPE au sein d'un même espace de travail Business.
  suspendu: { type: Boolean, default: false },
  suspensionMotif: { type: String, default: '' },
}, { timestamps: true });

// Un compte est "premium" tant que son abonnement payant (pro/business) n'a pas expiré.
userSchema.virtual('estPremium').get(function () {
  if (this.subscription === 'gratuit') return false;
  if (!this.abonnement || !this.abonnement.dateFin) return true; // legacy / sans date de fin
  return new Date(this.abonnement.dateFin) > new Date();
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Oryxa est actuellement mono-devise : toute ancienne valeur est normalisée en FCFA.
userSchema.pre('validate', function(next) {
  this.devise = 'FCFA';
  next();
});

module.exports = mongoose.model('User', userSchema);
