const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

module.exports = async function (req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Non autorisé' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const acteur = await User.findById(decoded.id).select('compteProprietaire role nom suspendu suspensionMotif emailVerifie');
    if (!acteur) return res.status(401).json({ message: 'Compte introuvable' });
    if (acteur.suspendu) {
      return res.status(403).json({
        message: acteur.suspensionMotif
          ? `Ce compte a été suspendu : ${acteur.suspensionMotif}`
          : 'Ce compte a été suspendu. Contactez le support pour plus de détails.',
        code: 'COMPTE_SUSPENDU',
      });
    }

    // Les nouveaux tokens portent l'identifiant de session. Cela permet une
    // révocation immédiate (déconnexion, changement de mot de passe, logout
    // global) au lieu d'attendre l'expiration du JWT. Les anciens tokens sans
    // `sid` restent acceptés pour une transition sans casser les sessions déjà
    // émises avant le déploiement.
    if (decoded.sid) {
      const session = await Session.findOne({
        _id: decoded.sid,
        type: 'user',
        user: acteur._id,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }).select('_id');
      if (!session) return res.status(401).json({ message: 'Session expirée ou révoquée' });
    }

    req.actorId = String(acteur._id);
    req.actorNom = acteur.nom;
    req.userId = acteur.compteProprietaire ? String(acteur.compteProprietaire) : String(acteur._id);
    req.userRole = acteur.role;
    req.sessionId = decoded.sid || null;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalide' });
  }
};
