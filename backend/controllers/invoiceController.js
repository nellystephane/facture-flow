const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

// Génère un numéro de facture lisible : FAC-2024-0001
async function nextInvoiceNumber(owner) {
  const year = new Date().getFullYear();
  const count = await Invoice.countDocuments({ owner });
  const seq = String(count + 1).padStart(4, '0');
  return `FAC-${year}-${seq}`;
}

const ALLOWED = ['client', 'objet', 'dateEmission', 'dateEcheance', 'items', 'remise', 'tva', 'notes', 'statut', 'template'];

function pickFields(body) {
  const o = {};
  ALLOWED.forEach((f) => { if (body[f] !== undefined) o[f] = body[f]; });
  return o;
}

exports.getInvoices = asyncHandler(async (req, res) => {
  const { statut, client } = req.query;
  const filter = { owner: req.userId };
  if (statut) filter.statut = statut;
  if (client) filter.client = client;
  const invoices = await Invoice.find(filter)
    .populate('client', 'nom entreprise email telephone')
    .sort({ createdAt: -1 });
  res.json(invoices);
});

exports.getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, owner: req.userId })
    .populate('client')
    .populate('quote');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  res.json(invoice);
});

exports.createInvoice = asyncHandler(async (req, res) => {
  const data = pickFields(req.body);
  if (!data.client) return res.status(400).json({ message: 'Le client est requis' });
  data.owner = req.userId;
  data.numero = req.body.numero || await nextInvoiceNumber(req.userId);
  const invoice = await Invoice.create(data);
  await invoice.populate('client');
  res.status(201).json(invoice);
});

exports.updateInvoice = asyncHandler(async (req, res) => {
  const updates = pickFields(req.body);
  const invoice = await Invoice.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    updates,
    { new: true }
  ).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  res.json(invoice);
});

exports.patchInvoiceStatus = asyncHandler(async (req, res) => {
  const { statut } = req.body;
  const valid = ['brouillon', 'envoyee', 'vue', 'payee', 'en_retard', 'annulee'];
  if (!valid.includes(statut)) return res.status(400).json({ message: 'Statut invalide' });
  const invoice = await Invoice.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    { statut },
    { new: true }
  ).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  res.json(invoice);
});

exports.deleteInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  await Payment.deleteMany({ invoice: invoice._id });
  res.json({ message: 'Facture supprimée' });
});

// Convertit un devis en facture
exports.createFromQuote = asyncHandler(async (req, res) => {
  const Quote = require('../models/Quote');
  const quote = await Quote.findOne({ _id: req.params.id, owner: req.userId });
  if (!quote) return res.status(404).json({ message: 'Devis introuvable' });

  const invoice = await Invoice.create({
    owner: req.userId,
    client: quote.client,
    quote: quote._id,
    numero: await nextInvoiceNumber(req.userId),
    objet: quote.objet,
    dateEmission: Date.now(),
    items: quote.items.map(i => ({ description: i.description, quantite: i.quantite, prixUnitaire: i.prixUnitaire })),
    remise: quote.remise,
    tva: quote.tva,
    notes: quote.notes,
    statut: 'brouillon'
  });
  await invoice.populate('client');
  quote.statut = 'accepte';
  await quote.save();
  res.status(201).json(invoice);
});
