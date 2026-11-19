const mongoose = require('mongoose');
const { normalizeDevise, formatMoney } = require('../utils/currency');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Quote = require('../models/Quote');
const Payment = require('../models/Payment');
const fedapay = require('../utils/fedapay');
const email = require('../utils/email');
const { buildReceiptPdf } = require('../utils/pdfBuilder');
const { creerFactureDepuisDevis } = require('./invoiceController');
const LegalContent = require('../models/LegalContent');
const { calculatePaymentQuote } = require('../utils/financial');
const { PAID_PAYMENT_FILTER } = require('../utils/invoiceTotals');
const { getInvoiceBalance } = require('../utils/invoicePayments');
const { publicInvoiceDto, publicPaymentDto, publicQuoteDto, pickEmetteur } = require('../utils/publicDto');

const asyncHandler = require('../middleware/asyncHandler');

function tokenPublicValide(token) { return /^[a-f0-9]{40,64}$/i.test(String(token || '')); }

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
    Payment.aggregate([{ $match: PAID_PAYMENT_FILTER }, { $group: { _id: null, total: { $sum: '$montant' } } }]),
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
  if (!tokenPublicValide(req.params.token)) return res.status(404).json({ message: 'Lien public invalide.' });
  const invoice = await Invoice.findOne({ publicToken: req.params.token }).populate('client');
  if (!invoice || invoice.publicAccessRevoked) return res.status(404).json({ message: 'Lien public invalide ou révoqué.' });
  const user = await User.findById(invoice.owner).select('nom entreprise email telephone whatsapp adresse devise banque logoUrl');
  if (!invoice.dateVue && invoice.statut === 'envoyee') {
    // Mise à jour ciblée : ne réécrit pas toute la facture.
    await Invoice.updateOne({ _id: invoice._id, statut: 'envoyee', dateVue: null }, { $set: { dateVue: new Date(), statut: 'vue' } });
    invoice.dateVue = new Date();
    invoice.statut = 'vue';
  }
  const payments = await Payment.find({ invoice: invoice._id, ...PAID_PAYMENT_FILTER }).sort({ date: -1 });
  const balance = await getInvoiceBalance(invoice);
  const quote = await calculatePaymentQuote(balance.reste, invoice.fraisSupportesPar || 'utilisateur');
  res.json({
    invoice: publicInvoiceDto(invoice),
    emetteur: pickEmetteur(user, { withBanque: true }),
    totalTTC: balance.totalTTC,
    totalPaye: balance.totalPaye,
    payments: payments.map(publicPaymentDto),
    fraisPaiement: quote,
  });
});

// POST /api/public/invoices/:token/pay  { firstname, lastname, email, phone }
exports.initiateOnlinePayment = asyncHandler(async (req, res) => {
  if (!tokenPublicValide(req.params.token)) return res.status(404).json({ message: 'Lien public invalide.' });
  const invoice = await Invoice.findOne({ publicToken: req.params.token }).populate('client');
  if (!invoice || invoice.publicAccessRevoked) return res.status(404).json({ message: 'Lien public invalide ou révoqué.' });
  if (invoice.statut === 'payee') return res.status(400).json({ message: 'Cette facture est déjà réglée.' });
  if (invoice.statut === 'annulee') return res.status(400).json({ message: 'Cette facture a été annulée.' });
  if (normalizeDevise(invoice.devise) !== 'XOF') return res.status(400).json({ message: `Cette facture est en ${invoice.devise}. Le paiement en ligne est disponible uniquement pour les factures en FCFA : réglez-la par virement ou selon les indications de l'émetteur.` });

  const { firstname, lastname, email, phone } = req.body;
  if (!email) return res.status(400).json({ message: 'Email requis pour le paiement.' });

  const { reste } = await getInvoiceBalance(invoice);
  if (reste <= 0.5) return res.status(400).json({ message: 'Cette facture est déjà réglée.' });
  const fraisSupportesPar = invoice.fraisSupportesPar || 'utilisateur';

  // The payment page pre-fills the outstanding invoice balance, but the payer
  // may intentionally make a partial payment. Never trust the browser: the
  // requested amount is checked against the actual remaining balance here.
  const requestedAmount = req.body.montant === undefined || req.body.montant === ''
    ? reste
    : Number(req.body.montant);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return res.status(400).json({ message: 'Le montant à régler doit être supérieur à 0.' });
  }
  if (requestedAmount > reste + 0.5) {
    return res.status(400).json({ message: `Le montant ne peut pas dépasser le solde restant de ${formatMoney(reste, invoice.devise)}.` });
  }

  const quote = await calculatePaymentQuote(requestedAmount, fraisSupportesPar);
  const montant = quote.montantClientPaye;
  const publicBase = (process.env.CLIENT_URL_PUBLIC || (process.env.CLIENT_URL || '').split(',')[0] || '').replace(/\/$/, '');

  const { transactionId, paymentUrl } = await fedapay.createPaymentLink({
    amount: montant,
    description: `Facture ${invoice.numero}`,
    customer: { email, firstname, lastname, phone },
    callbackUrl: `${publicBase}/payer/${invoice.publicToken}?statut=retour`,
    metadata: { type: 'invoice', invoiceId: String(invoice._id), publicToken: invoice.publicToken, fraisSupportesPar, montantFacture: requestedAmount },
  });

  await Payment.create({
    owner: invoice.owner,
    invoice: invoice._id,
    montant,
    montantFacture: requestedAmount,
    montantClientPaye: montant,
    fraisPayin: quote.fraisPayinEstimes,
    fraisPayoutProvisionnes: quote.fraisPayoutEstimes,
    fraisSupportesPar,
    montantNetUtilisateur: quote.montantNetEstimeUtilisateur,
    methode: 'autre',
    origine: 'en_ligne',
    statut: 'en_attente',
    fedapayTransactionId: String(transactionId),
    note: `Initié en ligne par ${email}`,
  });

  res.json({ paymentUrl, montantFacture: requestedAmount, montantClientPaye: montant, fraisTransfert: quote.fraisTransfertClient });
});

// GET /api/public/invoices/:token/statut — pour le polling front après retour de paiement
exports.getPublicPaymentStatus = asyncHandler(async (req, res) => {
  if (!tokenPublicValide(req.params.token)) return res.status(404).json({ message: 'Lien public invalide.' });
  const invoice = await Invoice.findOne({ publicToken: req.params.token });
  if (!invoice || invoice.publicAccessRevoked) return res.status(404).json({ message: 'Lien public invalide ou révoqué.' });
  const dernierPaiement = await Payment.findOne({ invoice: invoice._id }).sort({ createdAt: -1 });
  res.json({ statutFacture: invoice.statut, dernierPaiement: dernierPaiement ? publicPaymentDto(dernierPaiement) : null });
});

// GET /api/public/invoices/:token/receipt/:paymentId — reçu téléchargeable par le client
exports.getPublicReceipt = asyncHandler(async (req, res) => {
  if (!tokenPublicValide(req.params.token) || !/^[a-f0-9]{24}$/i.test(String(req.params.paymentId || ''))) return res.status(404).json({ message: 'Lien public invalide.' });
  const invoice = await Invoice.findOne({ publicToken: req.params.token }).populate('client');
  if (!invoice || invoice.publicAccessRevoked) return res.status(404).json({ message: 'Lien public invalide ou révoqué.' });
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
  if (!tokenPublicValide(req.params.token)) return res.status(404).json({ message: 'Lien public invalide.' });
  const quote = await Quote.findOne({ publicToken: req.params.token }).populate('client');
  if (!quote || quote.publicAccessRevoked) return res.status(404).json({ message: 'Lien public invalide ou révoqué.' });
  const user = await User.findById(quote.owner).select('nom entreprise email telephone whatsapp adresse devise logoUrl');
  if (!quote.dateVue && quote.statut === 'envoye') {
    await Quote.updateOne({ _id: quote._id, dateVue: null }, { $set: { dateVue: new Date() } });
    quote.dateVue = new Date();
  }
  res.json({ quote: publicQuoteDto(quote), emetteur: pickEmetteur(user), totalTTC: quote.totalTTC });
});

// POST /api/public/quotes/:token/repondre  { action: 'accepter' | 'demander_infos', message? }
exports.respondPublicQuote = asyncHandler(async (req, res) => {
  if (!tokenPublicValide(req.params.token)) return res.status(404).json({ message: 'Lien public invalide.' });
  const { action, message } = req.body;
  if (!['accepter', 'demander_infos'].includes(action)) {
    return res.status(400).json({ message: 'Action invalide.' });
  }

  const quote = await Quote.findOne({ publicToken: req.params.token });
  if (!quote || quote.publicAccessRevoked) return res.status(404).json({ message: 'Lien public invalide ou révoqué.' });
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
    // Verrou atomique : un seul appel concurrent peut faire passer le devis
    // de `envoye`/`brouillon` à `accepte`. Cela empêche deux clics rapides ou
    // deux retries réseau de créer deux factures.
    const verrou = await Quote.findOneAndUpdate(
      { _id: quote._id, statut: { $ne: 'accepte' }, publicAccessRevoked: { $ne: true } },
      { $set: { statut: 'accepte' } },
      { returnDocument: 'after' }
    );
    if (!verrou) return res.status(409).json({ message: 'Ce devis a déjà été accepté.' });

    let invoice;
    try {
      invoice = await creerFactureDepuisDevis(verrou, verrou.owner);
      verrou.invoiceGeneree = invoice._id;
      await verrou.save();
    } catch (err) {
      // Si la génération échoue, on libère le verrou pour qu'un retry légitime
      // puisse reprendre sans laisser le devis dans un état incohérent.
      await Quote.updateOne({ _id: verrou._id, invoiceGeneree: null }, { $set: { statut: 'envoye' } });
      throw err;
    }

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

    return res.json({ message: 'Devis accepté. Le prestataire a été notifié et prépare votre facture.', quote: publicQuoteDto(verrou) });
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

  res.json({ message: 'Votre demande a été transmise au prestataire.', quote: publicQuoteDto(quote) });
});

// Surcharge éventuelle d'une page légale, éditée depuis /admin — renvoie
// null si l'admin n'a jamais rien personnalisé pour cette page (le
// frontend affiche alors son contenu par défaut codé en dur).
exports.getLegalContent = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const doc = await LegalContent.findOne({ slug });
  res.json(doc || null);
});
