const User = require('../models/User');
const Subscription = require('../models/Subscription');
const fedapay = require('../utils/fedapay');
const { PLANS, FEATURES, ABONNEMENT_REDUCTION_PERCENT } = require('../config/plans');
const { permissionsDe, facturesCeMoisCi } = require('../utils/permissions');
const Invoice = require('../models/Invoice');
const PlatformSettings = require('../models/PlatformSettings');
const AffiliateReferral = require('../models/AffiliateReferral');

const asyncHandler = require('../middleware/asyncHandler');

// Grille tarifaire par défaut (utilisée tant qu'aucun admin n'a rien changé
// dans /admin > Tarifs — voir getTarifsActuels() ci-dessous, qui surcharge
// ces valeurs avec celles éventuellement enregistrées en base).
const TARIFS = {
  pro: { 1: 3500, 6: 17010, 12: 34020 },
  business: { 1: 6000, 6: 29160, 12: 58320 },
};
const MOIS_PAR_DUREE = { '1mois': 1, '6mois': 6, '1an': 12 };

// Toujours utiliser cette fonction plutôt que la constante TARIFS
// directement, pour que les tarifs édités depuis /admin s'appliquent sans
// redéploiement.
async function getTarifsActuels() {
  const settings = await PlatformSettings.findOne();
  if (!settings) return { pro: tarifsAvecReduction(TARIFS.pro[1]), business: tarifsAvecReduction(TARIFS.business[1]) };
  return {
    pro: tarifsAvecReduction(settings.tarifs?.pro?.[1] ?? TARIFS.pro[1]),
    business: tarifsAvecReduction(settings.tarifs?.business?.[1] ?? TARIFS.business[1]),
  };
}

function tarifsAvecReduction(prixMensuel) {
  const base = Math.max(0, Math.round(Number(prixMensuel) || 0));
  const facteur = 1 - (ABONNEMENT_REDUCTION_PERCENT / 100);
  return {
    1: base,
    6: Math.round(base * 6 * facteur),
    12: Math.round(base * 12 * facteur),
  };
}

function avantagesDe(planId) {
  const plan = PLANS[planId];
  const avantages = [];
  if (plan.limiteFacturesMois === null) avantages.push('Factures illimitées (pas de plafond mensuel)');
  FEATURES.forEach((f) => { if (plan[f.cle]) avantages.push(f.label); });
  return avantages;
}

async function calculerMontantAvecAffiliation({ ownerId, plan, duree, montantNormal, prixMensuel }) {
  const referral = await AffiliateReferral.findOne({ referredUser: ownerId, status: { $in: ['active', 'converted'] } });
  if (!referral) return { montant: montantNormal, remise: 0, referral: null };
  const settings = await PlatformSettings.getOrCreate();
  const pct = Math.max(0, Math.min(100, Number(settings.affiliate?.discountPercent || 0)));
  const maxMonths = Math.max(0, Number(settings.affiliate?.discountMonths || 0));
  if (!pct || !maxMonths) return { montant: montantNormal, remise: 0, referral };
  const mois = MOIS_PAR_DUREE[duree] || 1;
  const moisRestants = Math.max(0, Math.min(maxMonths - Number(referral.discountMonthsApplied || 0), mois));
  if (!moisRestants) return { montant: montantNormal, remise: 0, referral };
  // La remise d'engagement (19 %) reste appliquée à la durée choisie.
  // La remise affilié porte uniquement sur les premiers mois encore éligibles.
  const facteurEngagement = duree === '1mois' ? 1 : (1 - ABONNEMENT_REDUCTION_PERCENT / 100);
  const remise = Math.round(prixMensuel * facteurEngagement * (pct / 100) * moisRestants);
  return { montant: Math.max(0, montantNormal - remise), remise, referral, moisRemises: moisRestants };
}

exports.getPlans = asyncHandler(async (req, res) => {
  const TARIFS = await getTarifsActuels();
  const affiliateSettings = await PlatformSettings.getOrCreate();
  res.json({
    affiliate: { enabled: !!affiliateSettings.affiliate.enabled, discountPercent: affiliateSettings.affiliate.discountPercent, discountMonths: affiliateSettings.affiliate.discountMonths },
    plans: [
      {
        id: 'gratuit', nom: PLANS.gratuit.nom, accroche: PLANS.gratuit.accroche,
        prix: 0,
        avantages: [`${PLANS.gratuit.limiteFacturesMois} factures/mois`, `${PLANS.gratuit.limiteDevisMois} devis/mois`, `${PLANS.gratuit.limiteClients} clients`, 'Paiement en ligne', 'Reçus automatiques'],
      },
      {
        id: 'pro', nom: PLANS.pro.nom, accroche: PLANS.pro.accroche, recommande: true,
        avantages: avantagesDe('pro'),
        options: [
          { duree: '1mois', mois: 1, prix: TARIFS.pro[1] },
          { duree: '6mois', mois: 6, prix: TARIFS.pro[6] },
          { duree: '1an', mois: 12, prix: TARIFS.pro[12] },
        ],
      },
      {
        id: 'business', nom: PLANS.business.nom, accroche: PLANS.business.accroche,
        avantages: ['Tout Pro', `Jusqu'à ${PLANS.business.maxMembres} utilisateurs`, 'Rôles & permissions', "Historique d'équipe", 'Support prioritaire'],
        options: [
          { duree: '1mois', mois: 1, prix: TARIFS.business[1] },
          { duree: '6mois', mois: 6, prix: TARIFS.business[6] },
          { duree: '1an', mois: 12, prix: TARIFS.business[12] },
        ],
      },
    ],
  });
});

exports.getComparatif = asyncHandler(async (req, res) => {
  const lignes = [
    { label: 'Factures', gratuit: `${PLANS.gratuit.limiteFacturesMois}/mois`, pro: 'Illimitées', business: 'Illimitées' },
    { label: 'Clients', gratuit: `${PLANS.gratuit.limiteClients}`, pro: 'Illimités', business: 'Illimités' },
    { label: 'Devis', gratuit: `${PLANS.gratuit.limiteDevisMois}/mois`, pro: 'Illimités', business: 'Illimités' },
    { label: 'Paiement en ligne', gratuit: true, pro: true, business: true },
    { label: 'Reçus automatiques', gratuit: true, pro: true, business: true },
    ...FEATURES.filter((f) => f.cle !== 'multiUtilisateurs').map((f) => ({
      label: f.label, gratuit: PLANS.gratuit[f.cle], pro: PLANS.pro[f.cle], business: PLANS.business[f.cle],
    })),
    { label: 'Multi-utilisateurs', gratuit: false, pro: false, business: true },
    { label: 'Rôles & permissions', gratuit: false, pro: false, business: true },
    { label: "Historique d'équipe", gratuit: false, pro: false, business: true },
    { label: 'Support prioritaire', gratuit: PLANS.gratuit.supportPrioritaire, pro: PLANS.pro.supportPrioritaire, business: PLANS.business.supportPrioritaire },
  ];
  res.json({ lignes });
});

exports.getPermissions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  const perms = permissionsDe(user);
  const utilisees = await facturesCeMoisCi(Invoice, req.userId);

  res.json({
    plan: perms.plan,
    planNom: perms.planNom,
    role: req.userRole,
    facturation: {
      limite: perms.limiteFacturesMois,
      utilisees,
      illimitee: perms.limiteFacturesMois === null,
    },
    limites: { devisMois: perms.limiteDevisMois, clients: perms.limiteClients },
    peutUtiliserFacturationExpress: perms.peutUtiliserFacturationExpress(),
    peutUtiliserLogoPersonnalise: perms.peutUtiliserLogoPersonnalise(),
    peutUtiliserRelancesAutomatiques: perms.peutUtiliserRelancesAutomatiques(),
    peutVoirStatistiquesAvancees: perms.peutVoirStatistiquesAvancees(),
    peutExporterComptabilite: perms.peutExporterComptabilite(),
    peutGererEquipe: perms.plan === 'business' && (req.userRole === 'proprietaire' || req.userRole === 'admin'),
    modelesFactureDisponibles: perms.modelesFactureDisponibles(),
  });
});

exports.subscribe = asyncHandler(async (req, res) => {
  const { plan, duree } = req.body;
  const TARIFS = await getTarifsActuels();
  if (!TARIFS[plan]) return res.status(400).json({ message: 'Plan invalide' });
  if (!MOIS_PAR_DUREE[duree]) return res.status(400).json({ message: 'Durée invalide' });

  const mois = MOIS_PAR_DUREE[duree];
  const montantNormal = TARIFS[plan][mois];
  const prixMensuel = TARIFS[plan][1];
  const prix = await calculerMontantAvecAffiliation({ ownerId: req.userId, plan, duree, montantNormal, prixMensuel });
  const montant = prix.montant;

  const user = await User.findById(req.userId);
  const sub = await Subscription.create({
    owner: req.userId, plan, duree, montant, montantNormal, remiseAffiliation: prix.remise || 0, statut: 'en_attente',
  });

  const publicBase = (process.env.CLIENT_URL_PUBLIC || (process.env.CLIENT_URL || '').split(',')[0] || '').replace(/\/$/, '');
  const { transactionId, paymentUrl } = await fedapay.createPaymentLink({
    amount: montant,
    description: `Abonnement ${plan} — ${duree}`,
    customer: { email: user.email, firstname: user.nom },
    callbackUrl: `${publicBase}/app/profile?abonnement=retour`,
    metadata: { type: 'subscription', subscriptionId: String(sub._id) },
  });

  sub.fedapayTransactionId = String(transactionId);
  await sub.save();

  res.json({ paymentUrl, montant, montantNormal, remiseAffiliation: prix.remise || 0 });
});

exports.getStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('subscription abonnement');
  res.json(user);
});
