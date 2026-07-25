const User = require('../models/User');
const Subscription = require('../models/Subscription');
const fedapay = require('../utils/fedapay');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

// Tarifs de base — un abonnement annuel coûte moins cher au mois que le 6 mois,
// ce qui incite naturellement au choix long terme.
const TARIFS = {
  pro: { 6: 15000, 12: 25000 },       // ex: 2 500/mois vs ~2 083/mois
  business: { 6: 35000, 12: 60000 },  // ex: ~5 833/mois vs 5 000/mois
};

exports.getPlans = asyncHandler(async (req, res) => {
  res.json({
    plans: [
      {
        id: 'pro', nom: 'Pro',
        avantages: [
          'Factures et devis illimités',
          'Envoi de factures directement depuis un tarif préconçu',
          'Paiement en ligne (Mobile Money, carte, virement)',
          'Reçus automatiques',
        ],
        options: [
          { duree: '6mois', mois: 6, prix: TARIFS.pro[6] },
          { duree: '1an', mois: 12, prix: TARIFS.pro[12] },
        ],
      },
      {
        id: 'business', nom: 'Business',
        avantages: [
          'Tout Pro',
          'Plusieurs utilisateurs (à venir)',
          'Support prioritaire',
        ],
        options: [
          { duree: '6mois', mois: 6, prix: TARIFS.business[6] },
          { duree: '1an', mois: 12, prix: TARIFS.business[12] },
        ],
      },
    ],
  });
});

// POST /api/subscription/subscribe { plan: 'pro'|'business', duree: '6mois'|'1an' }
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

// GET /api/subscription/statut — pour rafraîchir l'état après retour de paiement
exports.getStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('subscription abonnement');
  res.json(user);
});
