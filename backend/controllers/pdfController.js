const Invoice = require('../models/Invoice');
const Quote = require('../models/Quote');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { buildInvoicePdf, buildQuotePdf, buildReceiptPdf } = require('../utils/pdfBuilder');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

function sendPdf(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  res.send(buffer);
}

function paymentUrlFor(invoice) {
  const base = process.env.CLIENT_URL_PUBLIC || (process.env.CLIENT_URL || '').split(',')[0];
  if (!base || !invoice.publicToken) return null;
  return `${base.replace(/\/$/, '')}/payer/${invoice.publicToken}`;
}

exports.invoicePdf = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, owner: req.userId }).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  const user = await User.findById(req.userId);
  const buffer = await buildInvoicePdf({ invoice, user, paymentUrl: paymentUrlFor(invoice) });
  sendPdf(res, buffer, `Facture-${invoice.numero}.pdf`);
});

exports.quotePdf = asyncHandler(async (req, res) => {
  const quote = await Quote.findOne({ _id: req.params.id, owner: req.userId }).populate('client');
  if (!quote) return res.status(404).json({ message: 'Devis introuvable' });
  const user = await User.findById(req.userId);
  const buffer = await buildQuotePdf({ quote, user });
  sendPdf(res, buffer, `Devis-${quote.numero}.pdf`);
});

// Reçu PDF d'un paiement précis (accès propriétaire, authentifié)
exports.paymentReceiptPdf = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.paymentId, owner: req.userId });
  if (!payment) return res.status(404).json({ message: 'Paiement introuvable' });
  const invoice = await Invoice.findById(payment.invoice).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  const user = await User.findById(req.userId);
  const buffer = await buildReceiptPdf({ invoice, payment, user });
  sendPdf(res, buffer, `Recu-${invoice.numero}.pdf`);
});

// Utilisé côté front pour afficher le total déjà payé sur une facture
exports.invoiceStatus = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ invoice: req.params.id });
  const totalPaye = payments.reduce((s, p) => s + (p.statut !== 'echoue' ? (p.montant || 0) : 0), 0);
  res.json({ totalPaye, paiements: payments });
});
