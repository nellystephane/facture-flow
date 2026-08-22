
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authentifie la requête ET résout l'ESPACE DE TRAVAIL sur lequel elle
// s'applique (multi-utilisateurs, plan Business — voir models/User.js).
//
// - req.actorId  : l'utilisateur réellement connecté (celui du token).
// - req.userId   : le propriétaire de l'espace de travail sur lequel
//                  travailler — le sien si c'est un propriétaire, sinon
//                  celui de son compte propriétaire s'il est collaborateur.
// - req.userRole : 'proprietaire' | 'admin' | 'collaborateur'.
//
// Tous les contrôleurs existants filtrent déjà leurs requêtes par
// `owner: req.userId` : ce middleware est le SEUL endroit à connaître la
// distinction acteur/propriétaire, ce qui rend tout le reste du code
// multi-utilisateurs "gratuitement", sans toucher aux contrôleurs.
module.exports = async function (req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Non autorisé' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const acteur = await User.findById(decoded.id).select('compteProprietaire role nom');
    if (!acteur) return res.status(401).json({ message: 'Compte introuvable' });

    req.actorId = String(acteur._id);
    req.actorNom = acteur.nom;
    req.userId = acteur.compteProprietaire ? String(acteur.compteProprietaire) : String(acteur._id);
    req.userRole = acteur.role;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalide' });
  }
};
