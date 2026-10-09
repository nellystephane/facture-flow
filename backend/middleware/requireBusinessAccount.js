const User = require('../models/User');

// Bloque les fonctions de gestion pour les comptes affiliés uniquement.
module.exports = async function requireBusinessAccount(req, res, next) {
  try {
    const user = await User.findById(req.actorId).select('typeCompte compteProprietaire');
    if (!user) return res.status(401).json({ message: 'Compte introuvable.' });
    if (user.typeCompte === 'affilie' && !user.compteProprietaire) {
      return res.status(403).json({
        code: 'COMPTE_AFFILIE_UNIQUEMENT',
        message: 'Votre compte est actuellement réservé au programme d’affiliation. Activez votre espace utilisateur depuis votre tableau de bord affilié pour accéder à cette fonctionnalité.'
      });
    }
    return next();
  } catch (error) { return next(error); }
};
