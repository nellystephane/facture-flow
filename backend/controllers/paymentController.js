const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { buildReceiptPdf } = require('../utils/pdfBuilder');
const email = require('../utils/email');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

async function nextReceiptNumber(owner) {
  const year = new Date().getFullYear();
  const count = await Payment.countDocuments({ owner, statut: 'complete' });
  return `REC-${year}-${String(count + 1).padStart(4, '0')}`;
}

exports.getPayments = asyncHandler(async (req, res) => {
  const { invoice } = req.query;
  const filter = { owner: req.userId };
  if (invoice) filter.invoice = invoice;
  const payments = await Payment.find(filter)
    .populate({ path: 'invoice', populate: { path: 'client', select: 'nom entreprise' } })
    .sort({ date: -1 });
  res.json(payments);
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

  const payment = await Payment.create({
    owner: req.userId,
    invoice: invoiceId,
    montant,
    methode: methode || 'especes',
    origine: 'manuel',
    statut: 'complete',
    date,
    reference,
    note,
    receiptNumber: await nextReceiptNumber(req.userId),
  });

  // Si le total des paiements couvre la facture -> payée
  const all = await Payment.find({ invoice: invoiceId, statut: 'complete' });
  const totalPaye = all.reduce((s, p) => s + (p.montant || 0), 0);
  const ttc = (invoice.items || []).reduce((s, i) => s + (i.quantite || 0) * (i.prixUnitaire || 0), 0);
  const remise = invoice.remise || 0;
  const tva = invoice.tva || 0;
  const totalTTC = (ttc - remise) * (1 + tva / 100);
  if (totalPaye >= totalTTC - 0.01) {
    invoice.statut = 'payee';
    await invoice.save();
  } else if (totalPaye > 0 && invoice.statut === 'brouillon') {
    invoice.statut = 'envoyee';
    await invoice.save();
  }
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
});

exports.deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!payment) return res.status(404).json({ message: 'Paiement introuvable' });
  res.json({ message: 'Paiement supprimé' });
});
