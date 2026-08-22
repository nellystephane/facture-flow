// À utiliser APRÈS `auth`. Réserve une route aux rôles 'proprietaire' et
// 'admin' de l'espace de travail — utilisé pour la gestion d'équipe et
// l'abonnement/facturation, jamais pour les fonctionnalités métier
// courantes (un collaborateur doit pouvoir créer des factures librement).
module.exports = function requireProprietaireOuAdmin(req, res, next) {
  if (req.userRole !== 'proprietaire' && req.userRole !== 'admin') {
    return res.status(403).json({
      message: "Seuls le propriétaire du compte et les administrateurs peuvent effectuer cette action.",
      code: 'ROLE_INSUFFISANT',
    });
  }
  next();
};
