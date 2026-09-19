const { planEffectifDe } = require('../config/plans');

// Compte les factures créées ce mois-ci (mois calendaire, remis à zéro le
// 1er de chaque mois — jamais en supprimant d'anciennes factures, seulement
// en changeant la borne de la requête). Utilisé à la fois par la
// vérification de création ET par l'affichage "7/10 factures utilisées".
async function facturesCeMoisCi(Invoice, ownerId) {
  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);
  return Invoice.countDocuments({ owner: ownerId, createdAt: { $gte: debutMois } });
}

// Construit l'objet de permissions pour un utilisateur donné. Toutes les
// fonctions synchrones ; peutCreerFacture est à part car elle nécessite une
// requête en base (compteur mensuel) — voir verifierLimiteFactures ci-dessous
// pour l'utiliser comme garde-fou de création.
function permissionsDe(user) {
  const plan = planEffectifDe(user);
  return {
    plan: plan.id,
    planNom: plan.nom,
    limiteFacturesMois: plan.limiteFacturesMois,
    limiteDevisMois: plan.limiteDevisMois,
    limiteClients: plan.limiteClients,
    peutUtiliserFacturationExpress: () => plan.facturationExpress,
    peutUtiliserLogoPersonnalise: () => plan.logoPersonnalise,
    peutUtiliserRelancesAutomatiques: () => plan.relancesAutomatiques,
    peutVoirStatistiquesAvancees: () => plan.statistiquesAvancees,
    peutExporterComptabilite: () => plan.exportComptable,
    peutAjouterUtilisateur: (nbMembresActuel = 1) => plan.multiUtilisateurs && nbMembresActuel < plan.maxMembres,
    modelesFactureDisponibles: () => plan.modelesFacture,
    peutUtiliserModele: (id) => plan.modelesFacture.includes(id),
  };
}

// Garde-fou de création de facture — LA vérification serveur qui empêche un
// compte Gratuit de dépasser 10 factures/mois, quoi que fasse le frontend.
// Renvoie null si la création est autorisée, sinon un objet d'erreur prêt à
// être renvoyé tel quel en réponse HTTP 403.
async function verifierLimiteFactures(Invoice, user) {
  const plan = planEffectifDe(user);
  if (plan.limiteFacturesMois === null) return null; // illimité sur ce plan

  const count = await facturesCeMoisCi(Invoice, user._id);
  if (count >= plan.limiteFacturesMois) {
    return {
      message: `Limite de ${plan.limiteFacturesMois} factures/mois atteinte sur le plan ${plan.nom}. Passez au plan Pro pour des factures illimitées.`,
      code: 'FREE_LIMIT_REACHED',
      limite: plan.limiteFacturesMois,
      utilisees: count,
    };
  }
  return null;
}

module.exports = { permissionsDe, verifierLimiteFactures, facturesCeMoisCi };


async function verifierLimiteDevis(Quote, user) {
  const plan = planEffectifDe(user);
  if (plan.limiteDevisMois === null) return null;
  const debutMois = new Date();
  debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
  const count = await Quote.countDocuments({ owner: user._id, createdAt: { $gte: debutMois } });
  if (count >= plan.limiteDevisMois) {
    return { message: `Limite de ${plan.limiteDevisMois} devis/mois atteinte sur le plan ${plan.nom}. Passez au plan Pro pour des devis illimités.`, code: 'FREE_QUOTE_LIMIT_REACHED', limite: plan.limiteDevisMois, utilisees: count };
  }
  return null;
}

async function verifierLimiteClients(Client, user) {
  const plan = planEffectifDe(user);
  if (plan.limiteClients === null) return null;
  const count = await Client.countDocuments({ owner: user._id });
  if (count >= plan.limiteClients) {
    return { message: `Limite de ${plan.limiteClients} clients atteinte sur le plan ${plan.nom}. Passez au plan Pro pour gérer davantage de clients.`, code: 'FREE_CLIENT_LIMIT_REACHED', limite: plan.limiteClients, utilisees: count };
  }
  return null;
}

module.exports.verifierLimiteDevis = verifierLimiteDevis;
module.exports.verifierLimiteClients = verifierLimiteClients;
