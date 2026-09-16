const mongoose = require('mongoose');

// Journal d'activité minimal (avantage Business : "historique des actions
// des utilisateurs"). Volontairement simple — pas un système d'audit
// exhaustif de chaque requête, mais un historique lisible des actions
// métier significatives (création/changement de statut de facture ou
// devis, paiement enregistré...), suffisant pour qu'un propriétaire sache
// qui a fait quoi dans son équipe.
const activityLogSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  acteur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  acteurNom: { type: String, required: true },
  action: { type: String, required: true },
  ressource: { type: String, required: true },
  ressourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  details: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
