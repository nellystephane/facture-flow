const { captureException } = require('../utils/monitoring');

module.exports = function asyncHandler(fn) {
  return (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('Erreur:', err);
      captureException(err, { path: req.originalUrl, method: req.method });
      if (res.headersSent) return next(err);
      const status = Number(err.status) >= 400 && Number(err.status) < 500 ? Number(err.status) : 500;
      const message = process.env.NODE_ENV === 'production'
        ? (status < 500 ? (err.publicMessage || err.message || 'Requête invalide.') : 'Une erreur interne est survenue.')
        : (err.message || 'Erreur serveur');
      return res.status(status).json({ message });
    });
};
