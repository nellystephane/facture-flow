const mongoose = require('mongoose');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Quote = require('../models/Quote');
const Payment = require('../models/Payment');
const fedapay = require('../utils/fedapay');
const email = require('../utils/email');
const { buildReceiptPdf } = require('../utils/pdfBuilder');
const { creerFactureDepuisDevis } = require('./invoiceController');

const asyncHandler = require('../middleware/asyncHandler');

function computeTTC(invoice) {
  const sousTotal = (invoice.items || []).reduce((s, i) => s + (i.quantite || 0) * (i.prixUnitaire || 0), 0);
  const ht = sousTotal - (invoice.remise || 0);
  return ht * (1 + (invoice.tva || 0) / 100);
}

// ---- Statistiques publiques (landing page) ------------------------------
let cache = { data: null, expiresAt: 0 };
const CACHE_TTL_MS = 60 * 1000;

exports.getPublicStats = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json({ totalUtilisateurs: 0, totalFactures: 0, totalEncaisse: 0, ready: false });
  }
  const now = Date.now();
  if (cache.data && cache.expiresAt > now) return res.json(cache.data);

  const [totalUtilisateurs, totalFactures, encaisseAgg] = await Promise.all([
    User.countDocuments(),
    Invoice.countDocuments(),
    Payment.aggregate([{ $match: { statut: 'complete' } }, { $group: { _id: null, total: { $sum: '$montant' } } }]),
  ]);

  const data = {
    totalUtilisateurs,
    totalFactures,
    totalEncaisse: Math.round(encaisseAgg[0]?.total || 0),
    ready: true,
  };
  cache = { data, expiresAt: now + CACHE_TTL_MS };
  res.json(data);
});

// ---- Page de paiement publique -------------------------------------------

// GET /api/public/invoices/:token
exports.getPublicInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ publicToken: req.params.token }).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  const user = await User.findById(invoice.owner).select('nom entreprise email telephone adresse devise banque logoUrl');
  if (!invoice.dateVue && invoice.statut === 'envoyee') {
    invoice.dateVue = new Date();
    invoice.statut = 'vue';
    await invoice.save();
  }
  const payments = await Payment.find({ invoice: invoice._id, statut: 'complete' }).sort({ date: -1 });
  const totalPaye = payments.reduce((s, p) => s + (p.montant || 0), 0);
  res.json({ invoice, emetteur: user, totalTTC: computeTTC(invoice), totalPaye, payments });
});

// POST /api/public/invoices/:token/pay  { firstname, lastname, email, phone }
exports.initiateOnlinePayment = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ publicToken: req.params.token }).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  if (invoice.statut === 'payee') return res.status(400).json({ message: 'Cette facture est déjà réglée.' });
  if (invoice.statut === 'annulee') return res.status(400).json({ message: 'Cette facture a été annulée.' });

  const { firstname, lastname, email, phone } = req.body;
  if (!email) return res.status(400).json({ message: 'Email requis pour le paiement.' });

  const montant = computeTTC(invoice);
  const publicBase = (process.env.CLIENT_URL_PUBLIC || (process.env.CLIENT_URL || '').split(',')[0] || '').replace(/\/$/, '');

  const { transactionId, paymentUrl } = await fedapay.createPaymentLink({
    amount: montant,
    description: `Facture ${invoice.numero}`,
    customer: { email, firstname, lastname, phone },
    callbackUrl: `${publicBase}/payer/${invoice.publicToken}?statut=retour`,
    metadata: { type: 'invoice', invoiceId: String(invoice._id), publicToken: invoice.publicToken },
  });

  await Payment.create({
    owner: invoice.owner,
    invoice: invoice._id,
    montant,
    methode: 'carte',
    origine: 'en_ligne',
    statut: 'en_attente',
    fedapayTransactionId: String(transactionId),
    note: `Initié en ligne par ${email}`,
  });

  res.json({ paymentUrl });
});

// GET /api/public/invoices/:token/statut — pour le polling front après retour de paiement
exports.getPublicPaymentStatus = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ publicToken: req.params.token });
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  const dernierPaiement = await Payment.findOne({ invoice: invoice._id }).sort({ createdAt: -1 });
  res.json({ statutFacture: invoice.statut, dernierPaiement });
});

// GET /api/public/invoices/:token/receipt/:paymentId — reçu téléchargeable par le client
exports.getPublicReceipt = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ publicToken: req.params.token }).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  const payment = await Payment.findOne({ _id: req.params.paymentId, invoice: invoice._id, statut: 'complete' });
  if (!payment) return res.status(404).json({ message: 'Reçu indisponible' });
  const user = await User.findById(invoice.owner);
  const buffer = await buildReceiptPdf({ invoice, payment, user });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Recu-${invoice.numero}.pdf"`);
  res.send(buffer);
});

// ---- Page de devis publique (approbation / demande d'infos client) -------

// GET /api/public/quotes/:token
exports.getPublicQuote = asyncHandler(async (req, res) => {
  const quote = await Quote.findOne({ publicToken: req.params.token }).populate('client');
  if (!quote) return res.status(404).json({ message: 'Devis introuvable' });
  const user = await User.findById(quote.owner).select('nom entreprise email telephone adresse devise logoUrl');
  if (!quote.dateVue && quote.statut === 'envoye') {
    quote.dateVue = new Date();
    await quote.save();
  }
  res.json({ quote, emetteur: user, totalTTC: quote.totalTTC });
});

// POST /api/public/quotes/:token/repondre  { action: 'accepter' | 'demander_infos', message? }
exports.respondPublicQuote = asyncHandler(async (req, res) => {
  const { action, message } = req.body;
  if (!['accepter', 'demander_infos'].includes(action)) {
    return res.status(400).json({ message: 'Action invalide.' });
  }

  const quote = await Quote.findOne({ publicToken: req.params.token });
  if (!quote) return res.status(404).json({ message: 'Devis introuvable' });
  if (quote.statut === 'accepte') {
    return res.status(409).json({ message: 'Ce devis a déjà été accepté.' });
  }

  const owner = await User.findById(quote.owner);
  const publicBase = (process.env.CLIENT_URL_PUBLIC || (process.env.CLIENT_URL || '').split(',')[0] || '').replace(/\/$/, '');

  if (action === 'accepter') {
    // On génère automatiquement une facture brouillon à partir du devis
    // accepté — jamais envoyée automatiquement au client : le propriétaire
    // du compte la relit et l'envoie lui-même quand il est prêt (voir
    // utils/email.sendQuoteAccepteeNotification).
    const invoice = await creerFactureDepuisDevis(quote, quote.owner);
    quote.statut = 'accepte';
    quote.invoiceGeneree = invoice._id;
    await quote.save();

    if (owner) {
      try {
        await email.sendQuoteAccepteeNotification({
          to: owner.email,
          quote,
          invoiceUrl: publicBase ? `${publicBase}/app/invoices/${invoice._id}` : undefined,
        });
      } catch (err) {
        console.error("Échec de la notification d'acceptation de devis:", err.message);
      }
    }

    return res.json({ message: 'Devis accepté. Le prestataire a été notifié et prépare votre facture.', quote });
  }

  // action === 'demander_infos'
  if (!message || !message.trim()) {
    return res.status(400).json({ message: 'Merci de préciser votre demande.' });
  }
  quote.demandeInfo = { message: message.trim(), date: new Date() };
  await quote.save();

  if (owner) {
    try {
      await email.sendQuoteInfoRequestNotification({ to: owner.email, quote, message: message.trim() });
    } catch (err) {
      console.error("Échec de la notification de demande d'infos:", err.message);
    }
  }

  res.json({ message: 'Votre demande a été transmise au prestataire.', quote });
});
