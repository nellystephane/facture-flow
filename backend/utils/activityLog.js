const ActivityLog = require('../models/ActivityLog');

// N'écrit jamais d'erreur bloquante : le journal d'activité est un
// à-côté, pas une opération critique — une facture doit se créer même si,
// pour une raison quelconque, l'écriture du log échoue.
async function enregistrerActivite(req, { action, ressource, ressourceId, details = '' }) {
  try {
    await ActivityLog.create({
      owner: req.userId,
      acteur: req.actorId,
      acteurNom: req.actorNom || 'Utilisateur',
      action,
      ressource,
      ressourceId,
      details,
    });
  } catch (err) {
    console.error("Échec d'écriture du journal d'activité:", err.message);
  }
}

module.exports = { enregistrerActivite };
