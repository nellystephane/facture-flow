const crypto = require('crypto');
const User = require('../models/User');
const AffiliateProfile = require('../models/AffiliateProfile');
const AffiliateReferral = require('../models/AffiliateReferral');
const AffiliateCommission = require('../models/AffiliateCommission');
const PlatformSettings = require('../models/PlatformSettings');
const WalletEntry = require('../models/WalletEntry');
const { getWalletBalance } = require('../utils/financial');
const asyncHandler = require('../middleware/asyncHandler');

function cleanCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
}

function generateCode(name = '') {
  const base = String(name || 'ORYXA').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'ORYXA';
  return `${base}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function uniqueCode(name) {
  for (let i = 0; i < 8; i += 1) {
    const code = generateCode(name);
    if (!(await AffiliateProfile.exists({ code }))) return code;
  }
  throw new Error('Impossible de générer un code affilié unique.');
}

async function getSettings() {
  return PlatformSettings.getOrCreate();
}

async function publicProfile(profile, user) {
  const wallet = await getWalletBalance(user._id);
  const referralCount = await AffiliateReferral.countDocuments({ affiliate: profile._id });
  const converted = await AffiliateReferral.countDocuments({ affiliate: profile._id, status: 'converted' });
  const commissions = await AffiliateCommission.aggregate([
    { $match: { affiliate: profile._id, statut: 'creditee' } },
    { $group: { _id: null, total: { $sum: '$montant' } } },
  ]);
  const settings = await getSettings();
  return {
    active: profile.active,
    code: profile.code,
    link: `${(process.env.CLIENT_URL_PUBLIC || (process.env.CLIENT_URL || '').split(',')[0] || '').replace(/\/$/, '')}/affiliation?ref=${encodeURIComponent(profile.code)}`,
    clicks: profile.clicks,
    signups: profile.signups || referralCount,
    paidReferrals: profile.paidReferrals || converted,
    totalCommission: commissions[0]?.total || 0,
    walletBalance: wallet,
    rules: {
      discountPercent: settings.affiliate.discountPercent,
      discountMonths: settings.affiliate.discountMonths,
      commissionPro: settings.affiliate.commissionPro,
      commissionBusiness: settings.affiliate.commissionBusiness,
    },
  };
}

exports.publicLanding = asyncHandler(async (req, res) => {
  const code = cleanCode(req.params.code);
  const profile = await AffiliateProfile.findOne({ code, active: true }).populate('user', 'nom entreprise');
  if (!profile) return res.status(404).json({ message: 'Code affilié introuvable.' });
  profile.clicks += 1;
  await profile.save();
  const settings = await getSettings();
  res.json({
    valid: true,
    code: profile.code,
    nom: profile.user?.nom || 'Un partenaire Oryxa',
    entreprise: profile.user?.entreprise || '',
    rules: {
      discountPercent: settings.affiliate.discountPercent,
      discountMonths: settings.affiliate.discountMonths,
      commissionPro: settings.affiliate.commissionPro,
      commissionBusiness: settings.affiliate.commissionBusiness,
    },
  });
});

exports.activate = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  if (!settings.affiliate.enabled) return res.status(403).json({ message: 'Le programme d’affiliation est momentanément fermé.' });

  const user = await User.findById(req.actorId).select('nom email emailVerifie telephone whatsapp');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });
  if (!user.emailVerifie) return res.status(403).json({ message: 'Confirmez votre adresse email avant d’activer l’affiliation.', code: 'EMAIL_NON_VERIFIE' });

  const telephone = String(req.body.telephone ?? user.telephone ?? '').trim();
  const whatsapp = String(req.body.whatsapp ?? user.whatsapp ?? '').trim();
  if (!telephone && !whatsapp) return res.status(400).json({ message: 'Un numéro de téléphone ou WhatsApp est requis pour participer au programme.' });
  const other = await User.findOne({
    _id: { $ne: user._id },
    $or: [
      ...(telephone ? [{ telephone }] : []),
      ...(whatsapp ? [{ whatsapp }] : []),
    ],
  }).select('_id');
  if (other) return res.status(409).json({ message: 'Ce numéro est déjà rattaché à un autre compte. Un seul compte affilié par numéro est autorisé.', code: 'PHONE_ALREADY_USED' });
  if (req.body.telephone !== undefined || req.body.whatsapp !== undefined) {
    user.telephone = telephone;
    user.whatsapp = whatsapp;
    await user.save();
  }

  let profile = await AffiliateProfile.findOne({ user: user._id });
  if (!profile) {
    profile = await AffiliateProfile.create({ user: user._id, code: await uniqueCode(user.nom) });
  } else if (!profile.active) {
    profile.active = true;
    await profile.save();
  }

  res.json({ affiliate: await publicProfile(profile, user) });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.actorId).select('nom email emailVerifie telephone whatsapp');
  const profile = await AffiliateProfile.findOne({ user: req.actorId });
  const settings = await getSettings();
  const referral = await AffiliateReferral.findOne({ referredUser: req.actorId, status: { $in: ['active', 'converted'] } }).lean();
  const remainingDiscountMonths = Math.max(0, Number(settings.affiliate.discountMonths || 0) - Number(referral?.discountMonthsApplied || 0));
  if (!profile) {
    return res.json({ active: false, eligible: !!user?.emailVerifie, hasPhone: !!(user?.telephone || user?.whatsapp), rules: settings.affiliate, remainingDiscountMonths, affiliate: null });
  }
  res.json({ active: profile.active, eligible: true, hasPhone: !!(user?.telephone || user?.whatsapp), rules: settings.affiliate, remainingDiscountMonths, affiliate: await publicProfile(profile, user) });
});

exports.dashboard = asyncHandler(async (req, res) => {
  const profile = await AffiliateProfile.findOne({ user: req.actorId });
  if (!profile || !profile.active) return res.status(404).json({ message: 'Espace affilié non activé.' });
  const [user, referrals, commissions, walletBalance] = await Promise.all([
    User.findById(req.actorId).select('nom email telephone whatsapp'),
    AffiliateReferral.find({ affiliate: profile._id }).populate('referredUser', 'nom email subscription abonnement').sort({ createdAt: -1 }).limit(100).lean(),
    AffiliateCommission.find({ affiliate: profile._id }).populate('referredUser', 'nom email').populate('subscription', 'plan duree montant statut').sort({ createdAt: -1 }).limit(100).lean(),
    getWalletBalance(req.actorId),
  ]);
  res.json({ affiliate: await publicProfile(profile, user), referrals, commissions, walletBalance });
});

exports.attributeRegistration = async function attributeRegistration(userId, code) {
  const normalized = cleanCode(code);
  if (!normalized) return null;
  const profile = await AffiliateProfile.findOne({ code: normalized, active: true });
  if (!profile || String(profile.user) === String(userId)) return null;
  const existing = await AffiliateReferral.findOne({ referredUser: userId });
  if (existing) return existing;
  const referral = await AffiliateReferral.create({ affiliate: profile._id, referredUser: userId, code: profile.code, status: 'pending_email' });
  await AffiliateProfile.updateOne({ _id: profile._id }, { $inc: { signups: 1 } });
  return referral;
};

exports.activateReferralAfterEmail = async function activateReferralAfterEmail(userId) {
  const referral = await AffiliateReferral.findOne({ referredUser: userId });
  if (!referral) return;
  if (referral.status === 'pending_email') {
    referral.status = 'active';
    await referral.save();
  }
};

exports.applySubscriptionCommission = async function applySubscriptionCommission(sub) {
  const referral = await AffiliateReferral.findOne({ referredUser: sub.owner, status: { $in: ['active', 'converted'] } }).populate('affiliate');
  if (!referral?.affiliate?.active) return null;
  if (String(referral.affiliate.user) === String(sub.owner)) return null;

  const settings = await getSettings();
  const montant = Number(sub.plan === 'business' ? settings.affiliate.commissionBusiness : settings.affiliate.commissionPro) || 0;
  if (montant <= 0) return null;

  const existing = await AffiliateCommission.findOne({ subscription: sub._id });
  if (existing) return existing;

  const commission = await AffiliateCommission.create({
    affiliate: referral.affiliate._id,
    referredUser: sub.owner,
    referral: referral._id,
    subscription: sub._id,
    plan: sub.plan,
    montant,
  });
  const walletEntry = await WalletEntry.create({
    owner: referral.affiliate.user,
    type: 'credit_affiliation',
    montant,
    reference: `affiliate-${commission._id}`,
    description: `Commission d’affiliation — abonnement ${sub.plan}`,
    metadata: { kind: 'affiliate_commission', commissionId: String(commission._id), referralId: String(referral._id), subscriptionId: String(sub._id) },
  });
  commission.walletEntry = walletEntry._id;
  await commission.save();

  const firstConversion = !referral.firstSubscription;
  referral.status = 'converted';
  referral.convertedAt = referral.convertedAt || new Date();
  referral.totalCommission += montant;
  referral.firstSubscription = referral.firstSubscription || sub._id;
  referral.lastSubscription = sub._id;
  const months = ({ '1mois': 1, '6mois': 6, '1an': 12 })[sub.duree] || 1;
  referral.discountMonthsApplied = Math.min(
    Number(settings.affiliate.discountMonths || 0),
    Number(referral.discountMonthsApplied || 0) + months
  );
  await referral.save();
  await AffiliateProfile.updateOne({ _id: referral.affiliate._id }, { $inc: { paidReferrals: firstConversion ? 1 : 0 } });
  return commission;
};

module.exports = exports;
