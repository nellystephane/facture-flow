const mongoose = require('mongoose');

// Document UNIQUE (singleton) : toujours récupéré/mis à jour via
// PlatformSettings.getOrCreate() ci-dessous, jamais par un _id spécifique.
// Sert à rendre éditables depuis la page admin des valeurs qui étaient
// figées en dur dans le code (grille tarifaire des abonnements, pourcentage
// de frais FedaPay utilisé pour calculer le revenu réel).
const platformSettingsSchema = new mongoose.Schema({
  tarifs: {
    pro: {
      1: { type: Number, default: 3500 },
      6: { type: Number, default: 19000 },
      12: { type: Number, default: 34000 },
    },
    business: {
      1: { type: Number, default: 6000 },
      6: { type: Number, default: 32000 },
      12: { type: Number, default: 58000 },
    },
  },
  // Pourcentage moyen prélevé par FedaPay sur chaque transaction en ligne —
  // utilisé uniquement pour ESTIMER le revenu net dans le tableau de bord
  // admin. FedaPay facture des frais différents selon l'opérateur mobile
  // money/la carte ; ce chiffre est une moyenne à ajuster par l'admin
  // pour coller à votre contrat réel avec FedaPay.
  fedapayFeePercent: { type: Number, default: 2.5 },
  // Paramètres de calcul prévisionnel. Les montants réellement facturés par
  // FedaPay sont toujours enregistrés depuis la réponse API/webhook et priment
  // sur ces valeurs.
  payoutFeeBrackets: {
    type: [{ seuilMax: { type: Number, required: true }, frais: { type: Number, required: true } }],
    default: [
      { seuilMax: 10000, frais: 150 },
      { seuilMax: 50000, frais: 300 },
      { seuilMax: 150000, frais: 800 },
      { seuilMax: 500000, frais: 2000 },
      { seuilMax: Number.MAX_SAFE_INTEGER, frais: 2500 },
    ],
  },
  payoutMinimum: { type: Number, default: 1000 },
  payoutSchedule: { type: String, enum: ['weekly', 'monthly'], default: 'weekly' },
}, { timestamps: true });

platformSettingsSchema.statics.getOrCreate = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
