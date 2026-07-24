const Quote = require('../models/Quote');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

async function nextQuoteNumber(owner) {
  const year = new Date().getFullYear();
  const count = await Quote.countDocuments({ owner });
  const seq = String(count + 1).padStart(4, '0');
  return `DEV-${year}-${seq}`;
}

const ALLOWED = ['client', 'objet', 'dateEmission', 'dateExpiration', 'items', 'remise', 'tva', 'notes', 'statut'];

function pickFields(body) {
  const o = {};
  ALLOWED.forEach((f) => { if (body[f] !== undefined) o[f] = body[f]; });
  return o;
}

exports.getQuotes = asyncHandler(async (req, res) => {
  const { statut } = req.query;
  const filter = { owner: req.userId };
  if (statut) filter.statut = statut;
  const quotes = await Quote.find(filter)
    .populate('client', 'nom entreprise email telephone')
    .sort({ createdAt: -1 });
  res.json(quotes);
});

exports.getQuoteById = asyncHandler(async (req, res) => {
  const quote = await Quote.findOne({ _id: req.params.id, owner: req.userId }).populate('client');
  if (!quote) return res.status(404).json({ message: 'Devis introuvable' });
  res.json(quote);
});

exports.createQuote = asyncHandler(async (req, res) => {
  const data = pickFields(req.body);
  if (!data.client) return res.status(400).json({ message: 'Le client est requis' });
  data.owner = req.userId;
  data.numero = req.body.numero || await nextQuoteNumber(req.userId);
  const quote = await Quote.create(data);
  await quote.populate('client');
  res.status(201).json(quote);
});

exports.updateQuote = asyncHandler(async (req, res) => {
  const updates = pickFields(req.body);
  const quote = await Quote.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    updates,
    { new: true }
  ).populate('client');
  if (!quote) return res.status(404).json({ message: 'Devis introuvable' });
  res.json(quote);
});

exports.patchQuoteStatus = asyncHandler(async (req, res) => {
  const { statut } = req.body;
  const valid = ['brouillon', 'envoye', 'accepte', 'refuse', 'expire'];
  if (!valid.includes(statut)) return res.status(400).json({ message: 'Statut invalide' });
  const quote = await Quote.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    { statut },
    { new: true }
  ).populate('client');
  if (!quote) return res.status(404).json({ message: 'Devis introuvable' });
  res.json(quote);
});

exports.deleteQuote = asyncHandler(async (req, res) => {
  const quote = await Quote.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!quote) return res.status(404).json({ message: 'Devis introuvable' });
  res.json({ message: 'Devis supprimé' });
});
