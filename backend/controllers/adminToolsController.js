const mongoose = require('mongoose');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const Subscription = require('../models/Subscription');
const SupportTicket = require('../models/SupportTicket');
const AdminAuditLog = require('../models/AdminAuditLog');
const SecurityEvent = require('../models/SecurityEvent');
const AffiliateProfile = require('../models/AffiliateProfile');
const AffiliateCommission = require('../models/AffiliateCommission');
const AffiliateReferral = require('../models/AffiliateReferral');
const asyncHandler = require('../middleware/asyncHandler');
const core = require('../utils/analyticsCore');
const adminCore = require('../utils/adminAnalytics');
const { getWalletBalance } = require('../utils/financial');
const { computeInvoiceTotals, PAID_PAYMENT_FILTER } = require('../utils/invoiceTotals');

exports.getAdminCatalog = asyncHandler(async (req, res) => {
  res.json({ metrics: adminCore.adminCatalog(), periods: core.PERIODS, statistiquesAvancees: true });
});

exports.getAdminAnalytics = asyncHandler(async (req, res) => {
  const demandes = String(req.query.metrics || '').split(',').map((s) => s.trim()).filter(Boolean);
  const metrics = [...new Set(demandes.filter((id) => adminCore.ADMIN_METRICS[id]))].slice(0, 8);
  if (!metrics.length) return res.status(400).json({ message: 'Choisissez au moins un élément à analyser.' });
  const range = core.resolveRange({ period: req.query.period || '6m', from: req.query.from, to: req.query.to });
  if (!range) return res.status(400).json({ message: 'Période invalide (365 jours maximum).' });
  const groupBy = core.pickGroupBy(range.from, range.to, req.query.groupBy);
  const dans = { $gte: range.from, $lte: range.to };
  const besoin = (...ids) => metrics.some((m) => ids.includes(m));

  const [users, invoices, subscriptions, commissions, payments, payouts, tickets, planCounts] = await Promise.all([
    besoin('nouveaux_comptes') ? User.find({ compteProprietaire: null, createdAt: dans }).select('createdAt').lean() : [],
    besoin('nouvelles_factures') ? Invoice.find({ createdAt: dans }).select('createdAt').lean() : [],
    besoin('revenu_abonnements', 'abonnements_payes', 'revenu_par_plan', 'abonnements_par_duree')
      ? Subscription.find({ statut: 'payee', createdAt: dans }).select('createdAt montant plan duree').lean() : [],
    besoin('commissions_affiliation') ? AffiliateCommission.find({ statut: 'creditee', createdAt: dans }).select('createdAt montant').lean() : [],
    besoin('volume_en_ligne') ? Payment.find({ origine: 'en_ligne', statut: 'complete', rembourse: false, createdAt: dans }).select('createdAt montant').lean() : [],
    besoin('reversements', 'reversements_par_statut') ? Payout.find({ createdAt: dans }).select('createdAt statut montant montantTransfere').lean() : [],
    besoin('tickets_support', 'tickets_par_statut') ? SupportTicket.find({ createdAt: dans }).select('createdAt statut').lean() : [],
    besoin('comptes_par_plan') ? User.aggregate([{ $match: { compteProprietaire: null } }, { $group: { _id: '$subscription', count: { $sum: 1 } } }]) : [],
  ]);

  res.json({ ...adminCore.computeAdminAnalytics({ metrics, range, groupBy, data: { users, invoices, subscriptions, commissions, payments, payouts, tickets, planCounts } }), verrouillees: [] });
});

// Fiche complète d'un compte : activité, abonnements, parrainage, support.
exports.getUserDetail = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide.' });
  const user = await User.findOne({ _id: req.params.id, compteProprietaire: null })
    .select('nom email entreprise telephone whatsapp subscription abonnement suspendu suspensionMotif emailVerifie createdAt');
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  const owner = user._id;

  const [nbFactures, nbClients, membres, facturesPayees, encaisse, abonnements, tickets, profil, solde] = await Promise.all([
    Invoice.countDocuments({ owner }),
    Client.countDocuments({ owner }),
    User.countDocuments({ compteProprietaire: owner }),
    Invoice.find({ owner, statut: 'payee' }).select('items remise tva fiscalisation.status fiscalisation.dgiTotal').lean(),
    Payment.aggregate([{ $match: { owner, ...PAID_PAYMENT_FILTER } }, { $group: { _id: null, total: { $sum: { $ifNull: ['$montantFacture', '$montant'] } } } }]),
    Subscription.find({ owner }).sort({ createdAt: -1 }).limit(10).select('plan duree montant statut dateDebut dateFin createdAt').lean(),
    SupportTicket.countDocuments({ owner }),
    AffiliateProfile.findOne({ user: owner }).lean(),
    getWalletBalance(owner),
  ]);

  let affiliation = null;
  if (profil) {
    const [filleuls, gagne] = await Promise.all([
      AffiliateReferral.countDocuments({ affiliate: profil._id }),
      AffiliateCommission.aggregate([{ $match: { affiliate: profil._id, statut: 'creditee' } }, { $group: { _id: null, total: { $sum: '$montant' } } }]),
    ]);
    affiliation = { code: profil.code, actif: profil.active, clics: profil.clicks, filleuls, commissions: gagne[0]?.total || 0 };
  }
  const parrain = await AffiliateReferral.findOne({ referredUser: owner }).populate({ path: 'affiliate', populate: { path: 'user', select: 'nom email' } }).lean();

  res.json({
    user,
    activite: {
      factures: nbFactures,
      clients: nbClients,
      membresEquipe: membres,
      facturesPayees: facturesPayees.length,
      chiffreAffairesFacture: Math.round(facturesPayees.reduce((s, i) => s + computeInvoiceTotals(i).totalTTC, 0)),
      encaisse: Math.round(encaisse[0]?.total || 0),
      soldeRetirable: Math.round(solde || 0),
      tickets,
    },
    abonnements,
    affiliation,
    parraine: parrain ? { code: parrain.code, par: parrain.affiliate?.user?.nom || parrain.affiliate?.user?.email || '', statut: parrain.status } : null,
  });
});

// Journal des actions d'administration + événements de sécurité.
exports.getAuditJournal = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const filtre = {};
  if (req.query.echecs === '1') filtre.success = false;
  if (req.query.methode && ['POST', 'PUT', 'PATCH', 'DELETE', 'GET'].includes(req.query.methode)) filtre.method = req.query.methode;
  if (req.query.q) filtre.path = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [audits, total, evenements] = await Promise.all([
    AdminAuditLog.find(filtre).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AdminAuditLog.countDocuments(filtre),
    page === 1 ? SecurityEvent.find({ severity: { $in: ['warning', 'critical'] } }).sort({ createdAt: -1 }).limit(20).lean() : [],
  ]);
  res.json({ audits, total, page, pages: Math.ceil(total / limit), evenements });
});

// État de santé : configuration (booléens seulement, jamais les valeurs) et tâches planifiées.
exports.getSystemStatus = asyncHandler(async (req, res) => {
  const e = process.env;
  const present = (...names) => names.every((n) => Boolean(e[n]));
  const jobs = await mongoose.connection.collection('joblocks').find({}).toArray().catch(() => []);
  const NOMS = { 'job:relances': 'Relances de paiement', 'job:reversements': 'Reversements', 'job:recurrentes': 'Factures récurrentes', 'job:abonnements': 'Abonnements expirés', 'job:comptes': 'Comptes non confirmés' };
  res.json({
    environnement: e.NODE_ENV || 'development',
    fedapayEnvironnement: e.FEDAPAY_ENVIRONMENT || null,
    base: mongoose.connection.readyState === 1,
    configuration: [
      { cle: 'Paiements FedaPay', ok: present('FEDAPAY_SECRET_KEY'), aide: 'FEDAPAY_SECRET_KEY' },
      { cle: 'Webhook FedaPay', ok: present('FEDAPAY_WEBHOOK_SECRET'), aide: 'FEDAPAY_WEBHOOK_SECRET' },
      { cle: 'Reversements activés', ok: e.FEDAPAY_PAYOUTS_ENABLED === 'true', aide: 'FEDAPAY_PAYOUTS_ENABLED=true' },
      { cle: 'E-mails (Brevo)', ok: present('BREVO_SMTP_USER', 'BREVO_SMTP_PASS') || present('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'), aide: 'BREVO_SMTP_*' },
      { cle: 'Déclencheur externe des tâches', ok: (e.CRON_SECRET || '').length >= 24, aide: 'CRON_SECRET (24 caractères min.)' },
      { cle: 'Chiffrement e-MECeF', ok: present('EMECEF_ENCRYPTION_KEY'), aide: 'EMECEF_ENCRYPTION_KEY' },
      { cle: 'Suivi d’erreurs (Sentry)', ok: present('SENTRY_DSN'), aide: 'SENTRY_DSN (facultatif)' },
      { cle: 'URL publique du site', ok: present('CLIENT_URL_PUBLIC'), aide: 'CLIENT_URL_PUBLIC' },
    ],
    taches: jobs.map((j) => ({
      nom: NOMS[j._id] || String(j._id),
      derniereExecution: j.lockedAt || null,
      enCours: Boolean(j.lockedUntil && new Date(j.lockedUntil) > new Date()),
    })),
  });
});

function csvCell(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

exports.exportUsersCsv = asyncHandler(async (req, res) => {
  const users = await User.find({ compteProprietaire: null }).select('nom email entreprise telephone subscription suspendu emailVerifie createdAt abonnement').sort({ createdAt: -1 }).limit(20000).lean();
  const lignes = [['Nom', 'Email', 'Entreprise', 'Téléphone', 'Plan', 'Fin d’abonnement', 'Email confirmé', 'Suspendu', 'Inscrit le']];
  users.forEach((u) => lignes.push([
    u.nom, u.email, u.entreprise, u.telephone, u.subscription,
    u.abonnement?.dateFin ? new Date(u.abonnement.dateFin).toISOString().slice(0, 10) : '',
    u.emailVerifie ? 'oui' : 'non', u.suspendu ? 'oui' : 'non', new Date(u.createdAt).toISOString().slice(0, 10),
  ]));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="oryxa-utilisateurs.csv"');
  res.send('﻿' + lignes.map((r) => r.map(csvCell).join(';')).join('\n'));
});

exports.exportSubscriptionsCsv = asyncHandler(async (req, res) => {
  const subs = await Subscription.find({ statut: 'payee' }).populate('owner', 'nom email').sort({ createdAt: -1 }).limit(20000).lean();
  const lignes = [['Date', 'Utilisateur', 'Email', 'Plan', 'Durée', 'Montant (FCFA)', 'Remise parrainage', 'Début', 'Fin']];
  subs.forEach((s) => lignes.push([
    new Date(s.createdAt).toISOString().slice(0, 10), s.owner?.nom, s.owner?.email, s.plan, s.duree, s.montant, s.remiseAffiliation || 0,
    s.dateDebut ? new Date(s.dateDebut).toISOString().slice(0, 10) : '', s.dateFin ? new Date(s.dateFin).toISOString().slice(0, 10) : '',
  ]));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="oryxa-abonnements.csv"');
  res.send('﻿' + lignes.map((r) => r.map(csvCell).join(';')).join('\n'));
});
