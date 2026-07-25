const User = require('../models/User');

// À utiliser APRÈS le middleware `auth`. Bloque l'accès si le compte est
// gratuit ou si son abonnement payant a expiré.
module.exports = async function requirePremium(req, res, next) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ message: 'Non autorisé' });

  const dateFin = user.abonnement?.dateFin;
  const estPremium = user.subscription !== 'gratuit' && (!dateFin || new Date(dateFin) > new Date());

  if (!estPremium) {
    return res.status(403).json({
      message: 'Cette fonctionnalité est réservée aux comptes Pro ou Business.',
      code: 'PREMIUM_REQUIRED',
    });
  }
  next();
};
