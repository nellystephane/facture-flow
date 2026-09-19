const crypto = require('crypto');
const User = require('../models/User');
const Payout = require('../models/Payout');
const { getWalletBalance } = require('../utils/financial');
const { createPayoutForOwner, reconcilePayout } = require('../utils/payout');
const email = require('../utils/email');
const asyncHandler = require('../middleware/asyncHandler');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function maskPhone(phone) {
  const value = String(phone || '');
  if (value.length <= 4) return value ? '••••' : '';
  return `${'•'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function publicPayoutSettings(settings) {
  const value = settings?.toObject?.() || settings || {};
  return {
    enabled: !!value.enabled,
    mode: value.mode || 'mobile_money',
    provider: value.provider || 'mtn',
    phone: value.phone || '',
    phoneMasked: maskPhone(value.phone),
    country: value.country || 'BJ',
    titulaire: value.titulaire || '',
    bank: value.bank || '',
    iban: value.iban || '',
    rib: value.rib || '',
    schedule: value.schedule || 'weekly',
    status: value.status || 'disabled',
    emailConfirmed: !!value.emailConfirmed,
    confirmedAt: value.confirmedAt || null,
  };
}

async function sendPayoutConfirmation(user, settings, token) {
  const publicBase = (process.env.CLIENT_URL_PUBLIC || (process.env.CLIENT_URL || '').split(',')[0] || '').replace(/\/$/, '');
  const confirmationUrl = `${publicBase}/confirmer-retrait/${encodeURIComponent(token)}`;
  return email.sendPayoutDestinationConfirmation({
    to: user.email,
    nom: user.nom,
    destination: settings.mode === 'mobile_money'
      ? `${settings.provider || 'Mobile Money'} — ${maskPhone(settings.phone)}`
      : `Compte bancaire — ${settings.iban ? `••••${settings.iban.slice(-4)}` : 'coordonnées enregistrées'}`,
    confirmationUrl,
  });
}

exports.getSummary = asyncHandler(async (req, res) => {
  const [user, soldeRetirable, derniers] = await Promise.all([
    User.findById(req.userId).select('payoutSettings'),
    getWalletBalance(req.userId),
    Payout.find({ owner: req.userId }).sort({ createdAt: -1 }).limit(10),
  ]);
  res.json({ soldeRetirable, payoutSettings: publicPayoutSettings(user?.payoutSettings) , payouts: derniers });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const { enabled, mode, provider, phone, country, titulaire, schedule, bank, iban, rib } = req.body;
  if (mode && !['mobile_money', 'bank_transfer'].includes(mode)) {
    return res.status(400).json({ message: 'Moyen de reversement invalide.' });
  }
  if (schedule && !['weekly', 'monthly'].includes(schedule)) {
    return res.status(400).json({ message: 'Fréquence de reversement invalide.' });
  }
  const user = await User.findById(req.userId).select('+payoutSettings.confirmationTokenHash +payoutSettings.confirmationTokenExpire');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

  const current = user.payoutSettings?.toObject?.() || user.payoutSettings || {};
  const nextMode = mode || current.mode || 'mobile_money';
  const nextPhone = phone !== undefined ? String(phone).trim() : String(current.phone || '').trim();
  const nextCountry = country ? String(country).toUpperCase() : (current.country || 'BJ');

  // Les cartes bancaires sont des moyens de paiement entrants FedaPay, pas une
  // destination de retrait : FedaPay indique actuellement que les retraits par
  // carte bancaire ne sont pas disponibles. On ne crée donc aucun faux payout.
  if (nextMode === 'mobile_money' && !nextPhone) {
    return res.status(400).json({ message: 'Le numéro Mobile Money est requis.' });
  }
  if (nextMode === 'bank_transfer' && !((iban || current.iban) || (rib || current.rib))) {
    return res.status(400).json({ message: 'Un IBAN ou RIB est requis pour un reversement bancaire.' });
  }

  const nextProvider = provider || current.provider || 'mtn';
  const nextTitulaire = titulaire !== undefined ? String(titulaire).trim() : String(current.titulaire || '').trim();

  const destinationChanged = nextMode !== current.mode
    || nextProvider !== String(current.provider || 'mtn')
    || nextPhone !== String(current.phone || '').trim()
    || nextCountry !== String(current.country || 'BJ').toUpperCase()
    || String(bank ?? current.bank ?? '') !== String(current.bank || '')
    || String(iban ?? current.iban ?? '') !== String(current.iban || '')
    || String(rib ?? current.rib ?? '') !== String(current.rib || '')
    || nextTitulaire !== String(current.titulaire || '').trim();

  const token = crypto.randomBytes(32).toString('hex');
  user.payoutSettings = {
    ...current,
    ...(enabled !== undefined ? { enabled: !!enabled } : {}),
    mode: nextMode,
    provider: nextProvider,
    phone: nextPhone,
    country: nextCountry,
    titulaire: nextTitulaire,
    bank: bank !== undefined ? String(bank).trim() : String(current.bank || '').trim(),
    iban: iban !== undefined ? String(iban).trim() : String(current.iban || '').trim(),
    rib: rib !== undefined ? String(rib).trim() : String(current.rib || '').trim(),
    schedule: schedule || current.schedule || 'weekly',
    ...(destinationChanged ? {
      status: 'pending',
      emailConfirmed: false,
      confirmedAt: null,
      confirmationTokenHash: hashToken(token),
      confirmationTokenExpire: new Date(Date.now() + 24 * 60 * 60 * 1000),
      enabled: false,
    } : {}),
  };

  await user.save();

  if (destinationChanged) {
    try {
      await sendPayoutConfirmation(user, user.payoutSettings, token);
    } catch (err) {
      return res.status(503).json({
        message: err.code === 'EMAIL_NOT_CONFIGURED'
          ? "Le moyen a été enregistré en attente, mais l'email de confirmation n'est pas configuré côté serveur."
          : "Le moyen a été enregistré en attente, mais l'email de confirmation n'a pas pu être envoyé.",
        code: err.code || 'PAYOUT_CONFIRMATION_EMAIL_FAILED',
        payoutSettings: publicPayoutSettings(user.payoutSettings),
      });
    }
  }

  res.json({
    payoutSettings: publicPayoutSettings(user.payoutSettings),
    confirmationRequired: destinationChanged,
    message: destinationChanged
      ? 'Moyen de retrait enregistré. Confirmez-le depuis l’email envoyé à votre adresse Oryxa avant tout reversement.'
      : 'Paramètres de reversement enregistrés.',
  });
});

exports.confirmDestination = asyncHandler(async (req, res) => {
  const token = String(req.params.token || '');
  if (!token || token.length < 32) return res.status(400).json({ message: 'Lien de confirmation invalide.' });
  const user = await User.findOne({
    'payoutSettings.confirmationTokenHash': hashToken(token),
    'payoutSettings.confirmationTokenExpire': { $gt: new Date() },
  }).select('+payoutSettings.confirmationTokenHash +payoutSettings.confirmationTokenExpire payoutSettings email nom');
  if (!user) return res.status(400).json({ message: 'Ce lien de confirmation est invalide ou expiré.' });

  user.payoutSettings.status = 'active';
  user.payoutSettings.emailConfirmed = true;
  user.payoutSettings.confirmedAt = new Date();
  user.payoutSettings.confirmationTokenHash = null;
  user.payoutSettings.confirmationTokenExpire = null;
  user.payoutSettings.enabled = true;
  await user.save();

  res.json({ message: 'Votre moyen de retrait est confirmé et peut désormais être utilisé pour les reversements.' });
});

exports.resendConfirmation = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('+payoutSettings.confirmationTokenHash +payoutSettings.confirmationTokenExpire payoutSettings nom email');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });
  const settings = user.payoutSettings || {};
  if (settings.status !== 'pending') return res.status(400).json({ message: 'Aucune confirmation de moyen de retrait en attente.' });

  const token = crypto.randomBytes(32).toString('hex');
  settings.confirmationTokenHash = hashToken(token);
  settings.confirmationTokenExpire = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  try {
    await sendPayoutConfirmation(user, settings, token);
  } catch (err) {
    return res.status(503).json({ message: "Impossible d'envoyer l'email de confirmation pour le moment.", code: err.code || 'PAYOUT_CONFIRMATION_EMAIL_FAILED' });
  }
  res.json({ message: 'Un nouvel email de confirmation a été envoyé.' });
});

exports.requestPayout = asyncHandler(async (req, res) => {
  try {
    const payout = await createPayoutForOwner(req.userId);
    if (!payout) return res.status(400).json({ message: 'Le solde retirable est inférieur au minimum de reversement.' });
    res.status(201).json(payout);
  } catch (err) {
    const status = ['FEDAPAY_NOT_CONFIGURED', 'FEDAPAY_PAYOUTS_DISABLED'].includes(err.code) ? 503 : 400;
    res.status(status).json({ message: err.message, code: err.code });
  }
});

exports.list = asyncHandler(async (req, res) => {
  const payouts = await Payout.find({ owner: req.userId }).sort({ createdAt: -1 }).limit(100);
  res.json({ payouts, soldeRetirable: await getWalletBalance(req.userId) });
});

exports.reconcile = asyncHandler(async (req, res) => {
  const payout = await Payout.findOne({ _id: req.params.id, owner: req.userId });
  if (!payout) return res.status(404).json({ message: 'Reversement introuvable.' });
  res.json(await reconcilePayout(payout));
});
