const cron = require('node-cron');
const User = require('../models/User');

// Le virtuel `estPremium` (voir models/User.js) tient déjà compte de la date
// de fin d'abonnement partout où c'est important (limite de factures, logo
// PDF, facturation express) : un abonnement expiré perd déjà ses avantages
// immédiatement, sans attendre ce job. Ce nettoyage est un complément
// d'hygiène des données : sans lui, le champ `subscription` reste bloqué sur
// "pro"/"business" indéfiniment après expiration, ce qui fausserait tout
// futur rapport ou export qui lirait ce champ directement plutôt que de
// recalculer estPremium.
async function nettoyerAbonnementsExpires() {
  const res = await User.updateMany(
    {
      subscription: { $ne: 'gratuit' },
      'abonnement.dateFin': { $lt: new Date() },
    },
    { $set: { subscription: 'gratuit' } }
  );
  if (res.modifiedCount > 0) {
    console.log(`[cron] ${res.modifiedCount} abonnement(s) expiré(s) repassé(s) en plan Gratuit.`);
  }
  return res.modifiedCount;
}

// Démarre la tâche planifiée (tous les jours à 3h du matin, heure du
// serveur). N'est appelé que par server.js au démarrage réel du serveur —
// jamais pendant les tests (voir server.js : `if (require.main === module)`).
function demarrerNettoyageAbonnements() {
  cron.schedule('0 3 * * *', () => {
    nettoyerAbonnementsExpires().catch((err) => {
      console.error('[cron] Échec du nettoyage des abonnements expirés :', err.message);
    });
  });
  console.log('[cron] Nettoyage quotidien des abonnements expirés programmé (3h00).');
}

module.exports = { nettoyerAbonnementsExpires, demarrerNettoyageAbonnements };
