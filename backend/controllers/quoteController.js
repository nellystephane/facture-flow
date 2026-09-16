const Quote = require('../models/Quote');
const Client = require('../models/Client');
const User = require('../models/User');
const { nextNumber } = require('../models/Counter');
const { paginationParams, paginatedResponse } = require('../utils/pagination');
const { buildQuotePdf } = require('../utils/pdfBuilder');
const email = require('../utils/email');
const { enregistrerActivite } = require('../utils/activityLog');

const asyncHandler = require('../middleware/asyncHandler');

// Numéro toujours généré côté serveur, jamais accepté depuis le client
// (voir models/Counter.js — séquence atomique, jamais réattribuée).
const nextQuoteNumber = (owner) => nextNumber(owner, 'devis');

// Un devis déjà accepté a généré une facture liée (voir
// publicController.respondPublicQuote) : le modifier ou le supprimer après
// coup rendrait la facture générée incohérente avec le devis d'origine.
const LOCKED_STATUTS = ['accepte'];

const ALLOWED = ['client', 'objet', 'dateEmission', 'dateExpiration', 'items', 'remise', 'tva', 'notes', 'statut'];

function pickFields(body) {
  const o = {};
  ALLOWED.forEach((f) => { if (body[f] !== undefined) o[f] = body[f]; });
  return o;
}

exports.getQuotes = asyncHandler(async (req, res) => {
  const { statut, q } = req.query;
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { owner: req.userId };
  if (statut) filter.statut = statut;
  if (q && q.trim()) {
    const re = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matchingClients = await Client.find({ owner: req.userId, nom: re }).select('_id');
    filter.$or = [{ numero: re }, { client: { $in: matchingClients.map((c) => c._id) } }];
  }
  const [items, total] = await Promise.all([
    Quote.find(filter)
      .populate('client', 'nom entreprise email telephone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Quote.countDocuments(filter),
  ]);
  res.json(paginatedResponse(items, total, page, limit));
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
  data.numero = await nextQuoteNumber(req.userId);
  const quote = await Quote.create(data);
  await quote.populate('client');
  enregistrerActivite(req, { action: 'devis.creee', ressource: 'devis', ressourceId: quote._id, details: `Devis ${quote.numero} créé` });
  res.status(201).json(quote);
});

exports.updateQuote = asyncHandler(async (req, res) => {
  const existing = await Quote.findOne({ _id: req.params.id, owner: req.userId });
  if (!existing) return res.status(404).json({ message: 'Devis introuvable' });
  if (LOCKED_STATUTS.includes(existing.statut)) {
    return res.status(409).json({
      message: 'Ce devis a déjà été accepté par le client et a généré une facture : il ne peut plus être modifié.',
      code: 'QUOTE_NOT_EDITABLE',
    });
  }
  const updates = pickFields(req.body);
  const quote = await Quote.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    updates,
    { new: true }
  ).populate('client');
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
  const existing = await Quote.findOne({ _id: req.params.id, owner: req.userId });
  if (!existing) return res.status(404).json({ message: 'Devis introuvable' });
  if (LOCKED_STATUTS.includes(existing.statut)) {
    return res.status(409).json({
      message: 'Ce devis a déjà été accepté par le client et a généré une facture : il ne peut plus être supprimé.',
      code: 'QUOTE_NOT_DELETABLE',
    });
  }
  await existing.deleteOne();
  res.json({ message: 'Devis supprimé' });
});

function quoteUrlFor(quote) {
  const base = process.env.CLIENT_URL_PUBLIC || (process.env.CLIENT_URL || '').split(',')[0];
  if (!base || !quote.publicToken) return null;
  return `${base.replace(/\/$/, '')}/devis/${quote.publicToken}`;
}

// Envoie le devis par email au client avec un lien public sur lequel il
// peut l'approuver ou demander des précisions (voir publicController).
exports.sendQuoteEmail = asyncHandler(async (req, res) => {
  const quote = await Quote.findOne({ _id: req.params.id, owner: req.userId }).populate('client');
  if (!quote) return res.status(404).json({ message: 'Devis introuvable' });
  if (!quote.client?.email) {
    return res.status(400).json({ message: "Ce client n'a pas d'adresse email enregistrée." });
  }

  const user = await User.findById(req.userId);
  const quoteUrl = quoteUrlFor(quote);
  const pdfBuffer = await buildQuotePdf({ quote, user });

  try {
    await email.sendQuoteEmail({ to: quote.client.email, quote, user, pdfBuffer, quoteUrl });
  } catch (err) {
    if (err.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(503).json({
        message: "L'envoi d'email n'est pas configuré côté serveur. Ajoutez les variables BREVO_SMTP_* dans backend/.env.",
        code: 'EMAIL_NOT_CONFIGURED',
      });
    }
    return res.status(502).json({ message: "Échec de l'envoi de l'email : " + err.message });
  }

  if (quote.statut === 'brouillon') quote.statut = 'envoye';
  quote.dateEnvoi = new Date();
  await quote.save();

  res.json({ message: 'Devis envoyé par email.', quote, quoteUrl });
});
