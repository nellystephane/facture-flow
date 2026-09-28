const jwt = require('jsonwebtoken');
const Session = require('../models/Session');
const { getConfiguredAdminEmail } = require('../utils/adminConfig');

module.exports = async function requireAdminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Accès admin non autorisé' });

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    if (!decoded.platformAdmin || !decoded.email) {
      return res.status(403).json({ message: 'Accès admin non autorisé' });
    }

    // L'accès admin est mono-compte : l'email du token doit toujours être
    // exactement celui configuré sur Render. Aucun rôle User ne peut devenir
    // admin depuis l'application.
    const configured = getConfiguredAdminEmail();
    if (!configured || decoded.email.toLowerCase() !== configured) {
      return res.status(403).json({ message: 'Accès admin non autorisé' });
    }

    if (decoded.sid) {
      const session = await Session.findOne({
        _id: decoded.sid,
        type: 'admin',
        adminEmail: configured,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }).select('_id');
      if (!session) return res.status(401).json({ message: 'Session admin expirée ou révoquée' });
    }

    req.adminEmail = configured;
    req.adminSessionId = decoded.sid || null;
    next();
  } catch {
    res.status(401).json({ message: 'Session admin expirée ou invalide' });
  }
};
