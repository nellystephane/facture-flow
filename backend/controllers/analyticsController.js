const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Client = require('../models/Client');
const Quote = require('../models/Quote');
const User = require('../models/User');
const AffiliateProfile = require('../models/AffiliateProfile');
const AffiliateCommission = require('../models/AffiliateCommission');
const AffiliateReferral = require('../models/AffiliateReferral');
const asyncHandler = require('../middleware/asyncHandler');
const { permissionsDe } = require('../utils/permissions');
const { PAID_PAYMENT_FILTER } = require('../utils/invoiceTotals');
const core = require('../utils/analyticsCore');

exports.getCatalog = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  const avance = permissionsDe(user).peutVoirStatistiquesAvancees();
  res.json({ metrics: core.catalog(avance), periods: core.PERIODS, statistiquesAvancees: avance });
});

exports.getAnalytics = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  const avance = permissionsDe(user).peutVoirStatistiquesAvancees();

  const demandes = String(req.query.metrics || '').split(',').map((s) => s.trim()).filter(Boolean);
  const connues = [...new Set(demandes.filter((id) => core.METRICS[id]))].slice(0, 8);
  if (!connues.length) return res.status(400).json({ message: 'Choisissez au moins un élément à analyser.' });
  const autorisees = connues.filter((id) => avance || !core.METRICS[id].pro);
  const verrouillees = connues.filter((id) => !autorisees.includes(id));
  if (!autorisees.length) {
    return res.status(403).json({ message: 'Ces analyses sont disponibles avec le plan Pro.', code: 'STATS_PRO_REQUIRED', verrouillees });
  }

  const range = core.resolveRange({ period: req.query.period || '6m', from: req.query.from, to: req.query.to });
  if (!range) return res.status(400).json({ message: 'Période invalide (365 jours maximum).' });
  const groupBy = core.pickGroupBy(range.from, range.to, req.query.groupBy);

  const owner = new mongoose.Types.ObjectId(req.userId);
  const dansPeriode = { $gte: range.from, $lte: range.to };
  const besoin = (...ids) => autorisees.some((m) => ids.includes(m));

  const [invoices, openInvoices, payments, expenses, clients, quotes] = await Promise.all([
    besoin('factures_emises', 'impayes', 'nb_factures', 'repartition_statuts', 'top_clients')
      ? Invoice.find({ owner, dateEmission: dansPeriode }).select('client statut dateEmission dateEcheance devise tauxChange items remise tva fiscalisation.status fiscalisation.dgiTotal').lean() : [],
    besoin('anciennete_creances')
      ? Invoice.find({ owner, statut: { $in: ['envoyee', 'vue', 'en_retard'] } }).select('statut dateEcheance devise tauxChange items remise tva fiscalisation.status fiscalisation.dgiTotal').lean() : [],
    besoin('encaissements', 'benefice', 'repartition_methodes')
      ? Payment.find({ owner, ...PAID_PAYMENT_FILTER, date: dansPeriode }).select('date montant montantFacture methode devise tauxChange').lean() : [],
    besoin('depenses', 'benefice', 'depenses_categories')
      ? Expense.find({ owner, date: dansPeriode }).select('date montant categorie').lean() : [],
    besoin('nouveaux_clients') ? Client.find({ owner, createdAt: dansPeriode }).select('createdAt').lean() : [],
    besoin('nb_devis', 'statuts_devis') ? Quote.find({ owner, dateEmission: dansPeriode }).select('dateEmission createdAt statut').lean() : [],
  ]);

  let commissionsAff = [];
  let referrals = [];
  if (besoin('commissions_affiliation', 'nouveaux_filleuls')) {
    const profil = await AffiliateProfile.findOne({ user: owner }).select('_id').lean();
    if (profil) {
      [commissionsAff, referrals] = await Promise.all([
        besoin('commissions_affiliation') ? AffiliateCommission.find({ affiliate: profil._id, statut: 'creditee', createdAt: dansPeriode }).select('montant createdAt').lean() : [],
        besoin('nouveaux_filleuls') ? AffiliateReferral.find({ affiliate: profil._id, createdAt: dansPeriode }).select('createdAt').lean() : [],
      ]);
    }
  }

  // Montants déjà payés sur les factures concernées (impayés partiels).
  const clientNames = {};
  const paidByInvoice = {};
  if (besoin('top_clients') && invoices.length) {
    const ids = [...new Set(invoices.map((i) => String(i.client)))];
    const rows = await Client.find({ owner, _id: { $in: ids } }).select('nom').lean();
    rows.forEach((c) => { clientNames[String(c._id)] = c.nom; });
  }
  if (besoin('impayes', 'anciennete_creances')) {
    const ids = [...invoices, ...openInvoices].map((i) => i._id);
    if (ids.length) {
      const rows = await Payment.aggregate([
        { $match: { owner, invoice: { $in: ids }, ...PAID_PAYMENT_FILTER } },
        { $group: { _id: '$invoice', total: { $sum: { $ifNull: ['$montantFacture', '$montant'] } } } },
      ]);
      rows.forEach((r) => { paidByInvoice[String(r._id)] = r.total; });
    }
  }

  const result = core.computeAnalytics({
    metrics: autorisees, range, groupBy,
    data: { invoices, openInvoices, payments, expenses, clients, quotes, clientNames, paidByInvoice, commissionsAff, referrals },
  });
  res.json({ ...result, verrouillees });
});
