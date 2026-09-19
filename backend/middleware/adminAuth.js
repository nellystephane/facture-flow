const jwt = require('jsonwebtoken');

// Auth complètement SÉPARÉE des comptes utilisateurs : un admin plateforme
// n'est PAS un User en base, juste un email autorisé (voir
// controllers/adminController.js#login et docs/ADMIN_ACCESS.md). Le token
// émis porte la marque `platformAdmin: true` et est vérifié ici sur CHAQUE
// route /api/admin/* (sauf /api/admin/login) — jamais réutilisable comme
// token utilisateur normal, ni l'inverse.
module.exports = function requireAdminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Accès admin non autorisé' });

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);
    if (!decoded.platformAdmin) {
      return res.status(403).json({ message: 'Accès admin non autorisé' });
    }
    req.adminEmail = decoded.email;
    next();
  } catch {
    res.status(401).json({ message: 'Session admin expirée ou invalide' });
  }
};
