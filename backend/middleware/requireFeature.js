const User = require('../models/User');
const { permissionsDe } = require('../utils/permissions');
const { FEATURES } = require('../config/plans');

const VERIFICATEURS = {
  facturationExpress: (p) => p.peutUtiliserFacturationExpress(),
  logoPersonnalise: (p) => p.peutUtiliserLogoPersonnalise(),
  relancesAutomatiques: (p) => p.peutUtiliserRelancesAutomatiques(),
  statistiquesAvancees: (p) => p.peutVoirStatistiquesAvancees(),
  exportComptable: (p) => p.peutExporterComptabilite(),
};

// À utiliser APRÈS le middleware `auth`. Bloque l'accès à une route tant que
// le plan effectif de l'utilisateur ne débloque pas la fonctionnalité `cle`
// (voir config/plans.js). Toute nouvelle fonctionnalité payante doit être
// ajoutée dans PLANS + FEATURES + VERIFICATEURS, puis simplement appliquée
// ici sur la route concernée — jamais de vérification "en dur" éparpillée
// dans les contrôleurs.
module.exports = function requireFeature(cle) {
  const verificateur = VERIFICATEURS[cle];
  if (!verificateur) {
    throw new Error(`requireFeature: fonctionnalité inconnue "${cle}" (voir middleware/requireFeature.js)`);
  }
  return async (req, res, next) => {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ message: 'Non autorisé' });

    if (!verificateur(permissionsDe(user))) {
      const feature = FEATURES.find((f) => f.cle === cle);
      return res.status(403).json({
        message: feature ? `${feature.label} est réservé aux plans Pro et Business.` : 'Fonctionnalité réservée à un plan supérieur.',
        code: 'FEATURE_LOCKED',
        feature: cle,
      });
    }
    req.user = user;
    next();
  };
};
