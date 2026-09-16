const { captureException } = require('../utils/monitoring');

// Wrapper standard pour toute route asynchrone : évite un try/catch dans
// chaque contrôleur, journalise l'erreur, la transmet à Sentry si configuré
// (voir utils/monitoring.js), et répond au client avec un message générique
// — jamais la stack trace complète, pour ne pas exposer de détails internes.
module.exports = function asyncHandler(fn) {
  return (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('Erreur:', err);
      captureException(err, { path: req.originalUrl, method: req.method });
      res.status(500).json({ message: 'Erreur serveur', error: err.message });
    });
};
