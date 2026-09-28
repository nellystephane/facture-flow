const AdminAuditLog = require('../models/AdminAuditLog');

module.exports = function adminAudit(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    // GET de lecture est conservé dans le journal pour les opérations admin
    // sensibles ; les endpoints statiques répétitifs peuvent être filtrés ici
    // plus tard sans changer le format.
    AdminAuditLog.create({
      adminEmail: req.adminEmail || 'unknown',
      action: `${req.method.toLowerCase()} ${req.route?.path || req.path}`,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ip: req.ip || '',
      userAgent: String(req.get('user-agent') || '').slice(0, 1000),
      success: res.statusCode < 400,
      details: `durationMs=${Date.now() - started}`,
    }).catch((err) => console.error('Échec audit admin:', err.message));
  });
  next();
};
