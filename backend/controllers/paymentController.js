const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

exports.getPayments = asyncHandler(async (req, res) => {
  const { invoice } = req.query;
  const filter = { owner: req.userId };
  if (invoice) filter.invoice = invoice;
  const payments = await Payment.find(filter)
    .populate({ path: 'invoice', populate: { path: 'client', select: 'nom entreprise' } })
    .sort({ date: -1 });
  res.json(payments);
});

exports.createPayment = asyncHandler(async (req, res) => {
  const { invoice: invoiceId, montant, methode, date, reference, note } = req.body;
  if (!invoiceId || montant === undefined) {
    return res.status(400).json({ message: 'Facture et montant requis' });
  }
  const invoice = await Invoice.findOne({ _id: invoiceId, owner: req.userId });
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });

  const payment = await Payment.create({
    owner: req.userId,
    invoice: invoiceId,
    montant,
    methode,
    date,
    reference,
    note
  });

  // Si le total des paiements couvre la facture -> payée
  const all = await Payment.find({ invoice: invoiceId });
  const totalPaye = all.reduce((s, p) => s + (p.montant || 0), 0);
  const ttc = (invoice.items || []).reduce((s, i) => s + (i.quantite || 0) * (i.prixUnitaire || 0), 0);
  const remise = invoice.remise || 0;
  const tva = invoice.tva || 0;
  const totalTTC = (ttc - remise) * (1 + tva / 100);
  if (totalPaye >= totalTTC - 0.01) {
    invoice.statut = 'payee';
    await invoice.save();
  } else if (totalPaye > 0) {
    invoice.statut = 'envoyee';
    await invoice.save();
  }
  await payment.populate({ path: 'invoice', populate: { path: 'client', select: 'nom entreprise' } });
  res.status(201).json(payment);
});

exports.deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!payment) return res.status(404).json({ message: 'Paiement introuvable' });
  res.json({ message: 'Paiement supprimé' });
});
