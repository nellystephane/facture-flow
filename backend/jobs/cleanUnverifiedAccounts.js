const cron = require('node-cron');
const User = require('../models/User');

// Un compte non confirmé ne peut de toute façon pas se connecter (voir
// authController.login) — ce nettoyage garantit qu'il finit aussi par
// disparaître complètement s'il n'est jamais confirmé, comme demandé :
// "un utilisateur ne peut être inscrit si son email n'est pas confirmé".
// 24h de délai (au lieu des 3 minutes de validité du code) pour laisser à
// quelqu'un qui a raté la fenêtre la possibilité de redemander un code
// avant que son compte ne disparaisse purement et simplement.
const DELAI_MS = 24 * 60 * 60 * 1000;

async function nettoyerComptesNonConfirmes() {
  const seuil = new Date(Date.now() - DELAI_MS);
  const res = await User.deleteMany({ emailVerifie: false, createdAt: { $lt: seuil } });
  if (res.deletedCount > 0) {
    console.log(`[cron] ${res.deletedCount} compte(s) jamais confirmé(s) supprimé(s).`);
  }
  return res.deletedCount;
}

function demarrerNettoyageComptesNonConfirmes() {
  // Une fois par jour à 4h du matin — en dehors de la fenêtre du nettoyage
  // des abonnements expirés (3h) pour ne pas cumuler la charge.
  cron.schedule('0 4 * * *', () => {
    nettoyerComptesNonConfirmes().catch((err) => {
      console.error('[cron] Échec du nettoyage des comptes non confirmés :', err.message);
    });
  });
  console.log('[cron] Nettoyage quotidien des comptes non confirmés programmé (4h00).');
}

module.exports = { nettoyerComptesNonConfirmes, demarrerNettoyageComptesNonConfirmes };
