const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { buildReceiptPdf } = require('../utils/pdfBuilder');
const email = require('../utils/email');
const { paginationParams, paginatedResponse } = require('../utils/pagination');
const { enregistrerActivite } = require('../utils/activityLog');
const WalletEntry = require('../models/WalletEntry');
const { getInvoiceBalance, syncInvoiceStatus } = require('../utils/invoicePayments');
const { PAID_PAYMENT_FILTER } = require('../utils/invoiceTotals');

const asyncHandler = require('../middleware/asyncHandler');

async function nextReceiptNumber(owner) {
  const { nextNumber } = require('../models/Counter');
  return nextNumber(owner, 'recu');
}

exports.getPaymentsStats = asyncHandler(async (req, res) => {
  const owner = new mongoose.Types.ObjectId(req.userId);
  const [totalAgg, parMethode] = await Promise.all([
    Payment.aggregate([
      { $match: { owner, ...PAID_PAYMENT_FILTER } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$montantFacture', '$montant'] } }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { owner, ...PAID_PAYMENT_FILTER } },
      { $group: { _id: '$methode', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
  ]);
  res.json({
    totalEncaisse: totalAgg[0]?.total || 0,
    nombrePaiements: totalAgg[0]?.count || 0,
    methodePlusFrequente: parMethode[0]?._id || null,
  });
});

exports.getPayments = asyncHandler(async (req, res) => {
  const { invoice, q } = req.query;
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { owner: req.userId };
  if (invoice) filter.invoice = invoice;
  if (q && q.trim()) {
    const re = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const Client = require('../models/Client');
    const Invoice = require('../models/Invoice');
    const matchingClients = await Client.find({ owner: req.userId, nom: re }).select('_id');
    const matchingInvoices = await Invoice.find({
      owner: req.userId,
      $or: [{ numero: re }, { client: { $in: matchingClients.map((c) => c._id) } }],
    }).select('_id');
    filter.$or = [{ reference: re }, { invoice: { $in: matchingInvoices.map((i) => i._id) } }];
  }
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate({ path: 'invoice', populate: { path: 'client', select: 'nom entreprise' } })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);
  res.json(paginatedResponse(items, total, page, limit));
});

// Enregistrement MANUEL d'un paiement par l'entrepreneur — couvre notamment
// le cas très courant du client qui paie en espèces. Le statut de la facture
// est mis à jour immédiatement, un reçu PDF est généré et, si le client a un
// email enregistré, il lui est envoyé automatiquement.
exports.createPayment = asyncHandler(async (req, res) => {
  const { invoice: invoiceId, montant, methode, date, reference, note } = req.body;
  if (!invoiceId || montant === undefined) {
    return res.status(400).json({ message: 'Facture et montant requis' });
  }
  const invoice = await Invoice.findOne({ _id: invoiceId, owner: req.userId }).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  if (invoice.statut === 'annulee') return res.status(400).json({ message: 'Cette facture est annulée : aucun paiement ne peut y être enregistré.' });

  const montantNum = Number(montant);
  if (!Number.isFinite(montantNum) || montantNum <= 0) {
    return res.status(400).json({ message: 'Le montant du paiement doit être supérieur à 0.' });
  }
  // Un paiement ne peut pas dépasser ce qu'il reste à payer (total DGI inclus).
  const avant = await getInvoiceBalance(invoice);
  if (montantNum > avant.reste + 0.5) {
    return res.status(400).json({ message: `Le montant dépasse le solde restant de cette facture (${Math.round(avant.reste)} FCFA).` });
  }

  const payment = await Payment.create({
    owner: req.userId,
    invoice: invoiceId,
    montant: montantNum,
    montantFacture: montantNum,
    montantClientPaye: montantNum,
    methode: methode || 'especes',
    origine: 'manuel',
    statut: 'complete',
    date,
    reference,
    note,
    receiptNumber: await nextReceiptNumber(req.userId),
  });

  // Statut de la facture déduit des paiements réels (source unique).
  await syncInvoiceStatus(invoice);
  await payment.populate({ path: 'invoice', populate: { path: 'client', select: 'nom entreprise' } });

  // Envoi du reçu par email — best effort : un échec d'email ne doit jamais
  // faire perdre l'enregistrement du paiement, déjà acté en base.
  let emailEnvoye = false;
  let emailErreur = null;
  if (invoice.client?.email) {
    try {
      const user = await User.findById(req.userId);
      const buffer = await buildReceiptPdf({ invoice, payment, user });
      await email.sendReceiptEmail({ to: invoice.client.email, invoice, user, payment, pdfBuffer: buffer });
      emailEnvoye = true;
    } catch (err) {
      emailErreur = err.code === 'EMAIL_NOT_CONFIGURED'
        ? "Paiement enregistré, mais l'envoi d'email n'est pas configuré côté serveur."
        : "Paiement enregistré, mais l'envoi du reçu par email a échoué.";
    }
  }

  res.status(201).json({ ...payment.toObject(), emailEnvoye, emailErreur });
  enregistrerActivite(req, { action: 'paiement.enregistre', ressource: 'paiement', ressourceId: payment._id, details: `Paiement de ${payment.montant} sur la facture ${invoice.numero}` });
});

exports.deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, owner: req.userId });
  if (!payment) return res.status(404).json({ message: 'Paiement introuvable' });
  if (payment.origine === 'en_ligne' && payment.statut === 'complete') {
    return res.status(409).json({ message: 'Un paiement en ligne confirmé ne peut pas être supprimé : il participe à votre historique financier et à votre solde retirable.', code: 'PAYMENT_FINANCIAL_LOCK' });
  }
  // Le ledger est immuable : on ne supprime jamais ses écritures. Un paiement
  // qui en a déjà produit (crédit, remboursement) ne peut donc pas être effacé.
  const ecritures = await WalletEntry.countDocuments({ payment: payment._id });
  if (ecritures > 0) {
    return res.status(409).json({ message: 'Ce paiement a déjà généré des écritures financières et ne peut pas être supprimé.', code: 'PAYMENT_FINANCIAL_LOCK' });
  }
  const invoiceId = payment.invoice;
  await payment.deleteOne();
  await syncInvoiceStatus(invoiceId);
  res.json({ message: 'Paiement supprimé' });
});
