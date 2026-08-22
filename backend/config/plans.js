// ===== Définition centrale des plans FactuFlow =====
// Source unique de vérité pour ce que chaque plan permet. Toute nouvelle
// fonctionnalité à gater derrière un plan payant doit être ajoutée ICI, puis
// exposée comme fonction dans utils/permissions.js — jamais vérifiée "en
// dur" (if user.subscription === 'pro') dispersée dans les contrôleurs.
//
// Gratuit  = découvrir le produit
// Pro      = gagner du temps et automatiser
// Business = gérer une équipe et une entreprise (= tout Pro + collaboration)

const PLANS = {
  gratuit: {
    id: 'gratuit',
    nom: 'Gratuit',
    accroche: 'Pour commencer',
    limiteFacturesMois: 10,
    facturationExpress: false,
    logoPersonnalise: false,
    relancesAutomatiques: false,
    statistiquesAvancees: false,
    exportComptable: false,
    modelesFacture: ['classique'],
    multiUtilisateurs: false,
    maxMembres: 1,
    supportPrioritaire: false,
  },
  pro: {
    id: 'pro',
    nom: 'Pro',
    accroche: 'Pour travailler plus efficacement',
    recommande: true,
    limiteFacturesMois: null, // illimité
    facturationExpress: true,
    logoPersonnalise: true,
    relancesAutomatiques: true,
    statistiquesAvancees: true,
    exportComptable: true,
    modelesFacture: ['classique', 'moderne', 'minimal'],
    multiUtilisateurs: false,
    maxMembres: 1,
    supportPrioritaire: false,
  },
  business: {
    id: 'business',
    nom: 'Business',
    accroche: 'Pour les équipes et entreprises',
    limiteFacturesMois: null,
    facturationExpress: true,
    logoPersonnalise: true,
    relancesAutomatiques: true,
    statistiquesAvancees: true,
    exportComptable: true,
    modelesFacture: ['classique', 'moderne', 'minimal'],
    multiUtilisateurs: true,
    maxMembres: 5,
    supportPrioritaire: true,
  },
};

// Fonctionnalités "booléennes" gatables — utilisées pour générer le
// comparateur et les messages d'état verrouillé automatiquement, sans dupliquer
// les libellés à chaque endroit du code.
const FEATURES = [
  { cle: 'facturationExpress', label: 'Facturation express', description: "Créez une facture directement à partir d'un tarif enregistré, sans passer par un devis." },
  { cle: 'logoPersonnalise', label: 'Logo personnalisé', description: 'Affichez votre logo sur vos factures, devis et reçus PDF.' },
  { cle: 'relancesAutomatiques', label: 'Relances automatiques', description: 'Un email de rappel est envoyé automatiquement à vos clients en cas de facture impayée.' },
  { cle: 'statistiquesAvancees', label: 'Statistiques avancées', description: "Évolution du chiffre d'affaires sur 6 mois et classement de vos meilleurs clients." },
  { cle: 'exportComptable', label: 'Export comptable', description: 'Exportez vos factures et paiements au format CSV pour votre comptable.' },
  { cle: 'multiUtilisateurs', label: 'Multi-utilisateurs', description: 'Invitez des collaborateurs à travailler avec vous sur le même compte.' },
];

function planDe(id) {
  return PLANS[id] || PLANS.gratuit;
}

// Le plan "effectif" d'un utilisateur : si son abonnement payant a expiré,
// il redescend immédiatement en Gratuit, quelle que soit la valeur brute du
// champ `subscription` en base (voir User.estPremium et le job
// jobs/cleanExpiredSubscriptions.js qui remet ce champ à jour périodiquement).
function planEffectifDe(user) {
  if (!user) return PLANS.gratuit;
  if (user.subscription !== 'gratuit' && !user.estPremium) return PLANS.gratuit;
  return planDe(user.subscription);
}

module.exports = { PLANS, FEATURES, planDe, planEffectifDe };
