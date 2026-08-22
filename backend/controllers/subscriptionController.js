const User = require('../models/User');
const Subscription = require('../models/Subscription');
const fedapay = require('../utils/fedapay');
const { PLANS, FEATURES } = require('../config/plans');
const { permissionsDe, facturesCeMoisCi } = require('../utils/permissions');
const Invoice = require('../models/Invoice');

const asyncHandler = require('../middleware/asyncHandler');

const TARIFS = {
  pro: { 6: 15000, 12: 25000 },
  business: { 6: 35000, 12: 60000 },
};

function avantagesDe(planId) {
  const plan = PLANS[planId];
  const avantages = [];
  if (plan.limiteFacturesMois === null) avantages.push('Factures illimitées (pas de plafond mensuel)');
  FEATURES.forEach((f) => { if (plan[f.cle]) avantages.push(f.label); });
  return avantages;
}

exports.getPlans = asyncHandler(async (req, res) => {
  res.json({
    plans: [
      {
        id: 'gratuit', nom: PLANS.gratuit.nom, accroche: PLANS.gratuit.accroche,
        prix: 0,
        avantages: [`${PLANS.gratuit.limiteFacturesMois} factures/mois`, 'Clients illimités', 'Devis illimités', 'Paiement en ligne', 'Reçus automatiques'],
      },
      {
        id: 'pro', nom: PLANS.pro.nom, accroche: PLANS.pro.accroche, recommande: true,
        avantages: avantagesDe('pro'),
        options: [
          { duree: '6mois', mois: 6, prix: TARIFS.pro[6] },
          { duree: '1an', mois: 12, prix: TARIFS.pro[12] },
        ],
      },
      {
        id: 'business', nom: PLANS.business.nom, accroche: PLANS.business.accroche,
        avantages: ['Tout Pro', `Jusqu'à ${PLANS.business.maxMembres} utilisateurs`, 'Rôles & permissions', "Historique d'équipe", 'Support prioritaire'],
        options: [
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
    { label: 'Clients', gratuit: 'Illimités', pro: 'Illimités', business: 'Illimités' },
    { label: 'Devis', gratuit: 'Illimités', pro: 'Illimités', business: 'Illimités' },
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
  if (!TARIFS[plan]) return res.status(400).json({ message: 'Plan invalide' });
  if (!['6mois', '1an'].includes(duree)) return res.status(400).json({ message: 'Durée invalide' });

  const mois = duree === '1an' ? 12 : 6;
  const montant = TARIFS[plan][mois];

  const user = await User.findById(req.userId);
  const sub = await Subscription.create({
    owner: req.userId, plan, duree, montant, statut: 'en_attente',
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

  res.json({ paymentUrl });
});

exports.getStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('subscription abonnement');
  res.json(user);
});
