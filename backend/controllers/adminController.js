const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const PlatformSettings = require('../models/PlatformSettings');
const LegalContent = require('../models/LegalContent');
const Payout = require('../models/Payout');
const WalletEntry = require('../models/WalletEntry');
const asyncHandler = require('../middleware/asyncHandler');
const email = require('../utils/email');

// ===== Authentification admin =====
// Liste blanche d'emails autorisés (voir docs/ADMIN_ACCESS.md) — jamais
// stockée en base, uniquement en variable d'environnement Render.
function emailsAutorises() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function motDePasseValide(motDePasseFourni) {
  if (process.env.ADMIN_PASSWORD_HASH) {
    return bcrypt.compare(motDePasseFourni, process.env.ADMIN_PASSWORD_HASH);
  }
  if (process.env.ADMIN_PASSWORD) {
    // Repli en clair pour démarrer rapidement — voir docs/ADMIN_ACCESS.md
    // pour passer à ADMIN_PASSWORD_HASH (recommandé) dès que possible.
    return motDePasseFourni === process.env.ADMIN_PASSWORD;
  }
  return false;
}

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis' });
  }

  const autorises = emailsAutorises();
  if (autorises.length === 0) {
    return res.status(500).json({ message: "Espace admin non configuré (ADMIN_EMAILS absent) — voir docs/ADMIN_ACCESS.md" });
  }

  const emailNormalise = email.trim().toLowerCase();
  if (!autorises.includes(emailNormalise) || !(await motDePasseValide(password))) {
    // Message volontairement identique dans les deux cas (email inconnu ou
    // mot de passe faux) pour ne pas révéler quels emails sont admin.
    return res.status(401).json({ message: 'Identifiants admin invalides' });
  }

  const token = jwt.sign(
    { platformAdmin: true, email: emailNormalise },
    process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token, email: emailNormalise });
});

// ===== Statistiques globales =====
exports.getStats = asyncHandler(async (req, res) => {
  const [totalUsers, parPlan, paiementsCompletes] = await Promise.all([
    User.countDocuments({ compteProprietaire: null }),
    User.aggregate([
      { $match: { compteProprietaire: null } },
      { $group: { _id: '$subscription', count: { $sum: 1 } } },
    ]),
    Payment.find({ statut: 'complete', rembourse: false }).select('montant origine createdAt'),
  ]);

  const abonnesParPlan = { gratuit: 0, pro: 0, business: 0 };
  parPlan.forEach((p) => { if (abonnesParPlan[p._id] !== undefined) abonnesParPlan[p._id] = p.count; });

  const revenuBrut = paiementsCompletes.reduce((s, p) => s + p.montant, 0);
  const revenuEnLigne = paiementsCompletes.filter((p) => p.origine === 'en_ligne').reduce((s, p) => s + p.montant, 0);

  const settings = await PlatformSettings.getOrCreate();
  const fraisEstimes = Math.round(revenuEnLigne * (settings.fedapayFeePercent / 100));
  const revenuReelEstime = revenuBrut - fraisEstimes;

  // Croissance des 6 derniers mois (nouveaux comptes propriétaires par mois)
  const depuis = new Date();
  depuis.setMonth(depuis.getMonth() - 5);
  depuis.setDate(1);
  depuis.setHours(0, 0, 0, 0);
  const nouveauxComptes = await User.aggregate([
    { $match: { compteProprietaire: null, createdAt: { $gte: depuis } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  res.json({
    totalUsers,
    abonnesParPlan,
    revenuBrut,
    fraisEstimes,
    revenuReelEstime,
    fedapayFeePercent: settings.fedapayFeePercent,
    croissanceMensuelle: nouveauxComptes.map((n) => ({ mois: n._id, nouveauxComptes: n.count })),
  });
});

// ===== Gestion des utilisateurs =====
exports.listUsers = asyncHandler(async (req, res) => {
  const { recherche = '', plan = '', page = 1, limite = 20 } = req.query;
  const filtre = { compteProprietaire: null };
  if (plan) filtre.subscription = plan;
  if (recherche) {
    filtre.$or = [
      { nom: { $regex: recherche, $options: 'i' } },
      { email: { $regex: recherche, $options: 'i' } },
      { entreprise: { $regex: recherche, $options: 'i' } },
    ];
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limite, 10) || 20));

  const [users, total] = await Promise.all([
    User.find(filtre).select('nom email entreprise subscription suspendu suspensionMotif emailVerifie createdAt abonnement')
      .sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
    User.countDocuments(filtre),
  ]);

  res.json({ users, total, page: p, pages: Math.ceil(total / l) });
});

exports.suspendreUtilisateur = asyncHandler(async (req, res) => {
  const { motif = '' } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { suspendu: true, suspensionMotif: motif },
    { new: true }
  ).select('nom email suspendu suspensionMotif');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  res.json(user);
});

exports.reactiverUtilisateur = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { suspendu: false, suspensionMotif: '' },
    { new: true }
  ).select('nom email suspendu');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  res.json(user);
});

exports.changerPlanUtilisateur = asyncHandler(async (req, res) => {
  const { subscription } = req.body;
  if (!['gratuit', 'pro', 'business'].includes(subscription)) {
    return res.status(400).json({ message: 'Plan invalide' });
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      subscription,
      // Un changement manuel par l'admin n'a pas de date d'expiration —
      // estPremium (voir models/User.js) le traite comme "sans limite"
      // tant qu'un admin ne repasse pas le compte en gratuit.
      'abonnement.dateFin': subscription === 'gratuit' ? null : null,
    },
    { new: true }
  ).select('nom email subscription');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  res.json(user);
});

// ===== Paiements =====
exports.listPayments = asyncHandler(async (req, res) => {
  const { statut = '', litige = '', page = 1, limite = 20 } = req.query;
  const filtre = {};
  if (statut) filtre.statut = statut;
  if (litige === 'true') filtre.litige = true;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limite, 10) || 20));

  const [payments, total] = await Promise.all([
    Payment.find(filtre).populate('owner', 'nom email').populate('invoice', 'numero')
      .sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
    Payment.countDocuments(filtre),
  ]);

  res.json({ payments, total, page: p, pages: Math.ceil(total / l) });
});

exports.signalerLitige = asyncHandler(async (req, res) => {
  const { note = '' } = req.body;
  const payment = await Payment.findByIdAndUpdate(req.params.id, { litige: true, litigeNote: note }, { new: true });
  if (!payment) return res.status(404).json({ message: 'Paiement introuvable' });
  if (payment.rembourse) return res.status(409).json({ message: 'Ce paiement est déjà marqué comme remboursé.' });
  if (payment.origine !== 'en_ligne' || payment.statut !== 'complete') return res.status(409).json({ message: 'Seul un paiement en ligne confirmé peut être marqué comme remboursé.' });
  if (payment.origine === 'en_ligne' && payment.statut === 'complete') {
    const WalletEntry = require('../models/WalletEntry');
    const exists = await WalletEntry.findOne({ payment: payment._id, type: 'debit_remboursement' });
    if (!exists && Number(payment.montantNetUtilisateur || 0) > 0) {
      await WalletEntry.create({
        owner: payment.owner,
        type: 'debit_remboursement',
        montant: Math.round(payment.montantNetUtilisateur),
        payment: payment._id,
        reference: `refund-${payment._id}`,
        description: 'Remboursement d’un paiement en ligne',
      });
    }
  }
  res.json(payment);
});

exports.resoudreLitige = asyncHandler(async (req, res) => {
  const payment = await Payment.findByIdAndUpdate(req.params.id, { litige: false }, { new: true });
  if (!payment) return res.status(404).json({ message: 'Paiement introuvable' });
  res.json(payment);
});

exports.marquerRembourse = asyncHandler(async (req, res) => {
  // Ceci enregistre le remboursement côté Oryxa pour le suivi admin — le
  // remboursement réel côté FedaPay se fait sur leur tableau de bord
  // marchand ; ce bouton ne déclenche aucun virement.
  const payment = await Payment.findByIdAndUpdate(
    req.params.id,
    { rembourse: true, rembourseLe: new Date() },
    { new: true }
  );
  if (!payment) return res.status(404).json({ message: 'Paiement introuvable' });
  res.json(payment);
});

// ===== Tarifs des abonnements =====
exports.getPricing = asyncHandler(async (req, res) => {
  const settings = await PlatformSettings.getOrCreate();
  res.json(settings);
});

exports.updatePricing = asyncHandler(async (req, res) => {
  const { tarifs, fedapayFeePercent, payoutFeeBrackets } = req.body;
  const settings = await PlatformSettings.getOrCreate();
  if (tarifs) settings.tarifs = tarifs;
  if (typeof fedapayFeePercent === 'number' && fedapayFeePercent >= 0 && fedapayFeePercent < 100) settings.fedapayFeePercent = fedapayFeePercent;
  if (Array.isArray(payoutFeeBrackets)) {
    const cleaned = payoutFeeBrackets
      .map((b) => ({ seuilMax: Number(b.seuilMax), frais: Number(b.frais) }))
      .filter((b) => Number.isFinite(b.seuilMax) && b.seuilMax > 0 && Number.isFinite(b.frais) && b.frais >= 0)
      .sort((a, b) => a.seuilMax - b.seuilMax);
    if (cleaned.length) settings.payoutFeeBrackets = cleaned;
  }
  await settings.save();
  res.json(settings);
});


// ===== Diagnostic email =====
// Réservé à l'administrateur : permet de vérifier en production que les
// identifiants SMTP configurés sur Render fonctionnent réellement.
exports.testEmail = asyncHandler(async (req, res) => {
  const to = String(req.body?.to || req.adminEmail || '').trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ message: 'Adresse email de test invalide.' });
  }

  if (!email.isEmailConfigured()) {
    return res.status(503).json({
      message: "SMTP non configuré. Ajoutez SMTP_HOST/SMTP_USER/SMTP_PASS ou BREVO_SMTP_HOST/BREVO_SMTP_USER/BREVO_SMTP_PASS dans Render.",
      code: 'EMAIL_NOT_CONFIGURED',
    });
  }

  await email.sendMail({
    to,
    subject: 'Test email Oryxa',
    html: '<p>Votre configuration email Oryxa fonctionne correctement.</p><p>Vous pouvez maintenant envoyer les codes de confirmation, notifications et messages du support.</p>',
  });

  res.json({ message: `Email de test envoyé à ${to}.` });
});

// ===== Contenu légal =====
exports.listLegalContent = asyncHandler(async (req, res) => {
  const docs = await LegalContent.find();
  res.json(docs);
});

exports.updateLegalContent = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { titre = '', contenu } = req.body;
  if (!['cgu', 'confidentialite', 'mentions-legales'].includes(slug)) {
    return res.status(400).json({ message: 'Page légale inconnue' });
  }
  const doc = await LegalContent.findOneAndUpdate(
    { slug },
    { titre, contenu, modifiePar: req.adminEmail },
    { new: true, upsert: true }
  );
  res.json(doc);
});


// ===== Finance / reversements =====
exports.getFinancials = asyncHandler(async (req, res) => {
  const [payments, payouts, walletAgg, payoutAgg] = await Promise.all([
    Payment.find({ origine: 'en_ligne', statut: 'complete', rembourse: false })
      .select('montant montantFacture montantClientPaye fraisPayin fraisPayoutProvisionnes fraisSupportesPar owner invoice fedapayTransactionId fedapayMode createdAt')
      .populate('owner', 'nom email')
      .populate('invoice', 'numero'),
    Payout.find().populate('owner', 'nom email').sort({ createdAt: -1 }).limit(200),
    WalletEntry.aggregate([
      { $group: { _id: '$type', total: { $sum: '$montant' }, count: { $sum: 1 } } },
    ]),
    Payout.aggregate([
      { $group: { _id: '$statut', montant: { $sum: '$montant' }, frais: { $sum: '$fraisFedaPay' }, debite: { $sum: '$montantDebite' }, transfere: { $sum: '$montantTransfere' }, count: { $sum: 1 } } },
    ]),
  ]);

  const feesClients = payments.reduce((sum, p) => sum + Math.max(0, (p.montantClientPaye ?? p.montant) - (p.montantFacture ?? p.montant)), 0);
  const payinFees = payments.reduce((sum, p) => sum + (p.fraisPayin || 0), 0);
  const payoutFees = payouts.reduce((sum, p) => sum + (p.fraisFedaPay || 0), 0);
  const margeTechnique = feesClients - payinFees - payoutFees;
  const mouvementEntries = walletAgg.map((x) => ({ type: x._id, total: x.total, count: x.count }));

  res.json({
    synthese: {
      encaisseEnLigne: payments.reduce((s, p) => s + (p.montant || 0), 0),
      montantFactures: payments.reduce((s, p) => s + (p.montantFacture ?? p.montant), 0),
      fraisFacturesAuxClients: feesClients,
      fraisPayinReels: payinFees,
      fraisPayoutReels: payoutFees,
      margeTechnique: margeTechnique,
    },
    mouvements: mouvementEntries,
    payouts,
    paiements: payments,
    repartitionPayouts: payoutAgg,
  });
});
