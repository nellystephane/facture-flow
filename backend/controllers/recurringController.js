const RecurringInvoice = require('../models/RecurringInvoice');
const User = require('../models/User');
const { resolveDocumentCurrency } = require('../utils/currency');
const Client = require('../models/Client');
const asyncHandler = require('../middleware/asyncHandler');
const { noonUtc, aujourdhuiMidi } = require('../utils/recurring');

function parseDay(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return noonUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

exports.getRecurring = asyncHandler(async (req, res) => {
  const items = await RecurringInvoice.find({ owner: req.userId }).populate('client', 'nom').sort({ createdAt: -1 });
  res.json(items);
});

exports.createRecurring = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.body.client, owner: req.userId });
  if (!client) return res.status(404).json({ message: 'Client introuvable' });
  const premiere = parseDay(req.body.prochaineEmission);
  if (!premiere) return res.status(400).json({ message: 'Date de première facture invalide.' });
  if (premiere < aujourdhuiMidi()) return res.status(400).json({ message: 'La première facture ne peut pas être dans le passé.' });
  const dateFin = req.body.dateFin ? parseDay(req.body.dateFin) : null;
  if (dateFin && dateFin < premiere) return res.status(400).json({ message: 'La date de fin précède la première facture.' });
  const user = await User.findById(req.userId).select('devise');
  const dev = resolveDocumentCurrency(req.body, user && user.devise);
  if (dev.error) return res.status(400).json({ message: dev.error });
  const item = await RecurringInvoice.create({
    ...req.body, ...dev.fields, owner: req.userId, prochaineEmission: premiere, dateFin, jourAncre: premiere.getUTCDate(),
  });
  await item.populate('client', 'nom');
  res.status(201).json(item);
});

exports.updateRecurring = asyncHandler(async (req, res) => {
  const allowed = ['titre', 'objet', 'items', 'remise', 'tva', 'notes', 'fraisSupportesPar', 'frequence', 'delaiEcheanceJours', 'envoiAutomatique', 'client'];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (req.body.prochaineEmission) {
    const d = parseDay(req.body.prochaineEmission);
    if (!d) return res.status(400).json({ message: 'Date invalide.' });
    updates.prochaineEmission = d; updates.jourAncre = d.getUTCDate();
  }
  if (req.body.dateFin !== undefined) updates.dateFin = req.body.dateFin ? parseDay(req.body.dateFin) : null;
  if (req.body.devise !== undefined || req.body.tauxChange !== undefined) {
    const actuel = await RecurringInvoice.findOne({ _id: req.params.id, owner: req.userId }).select('devise tauxChange');
    if (!actuel) return res.status(404).json({ message: 'Introuvable' });
    const dev = resolveDocumentCurrency(req.body, null, actuel);
    if (dev.error) return res.status(400).json({ message: dev.error });
    Object.assign(updates, dev.fields);
  }
  if (updates.client && !(await Client.findOne({ _id: updates.client, owner: req.userId }))) {
    return res.status(404).json({ message: 'Client introuvable' });
  }
  const item = await RecurringInvoice.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, updates, { returnDocument: 'after', runValidators: true }).populate('client', 'nom');
  if (!item) return res.status(404).json({ message: 'Introuvable' });
  res.json(item);
});

exports.setActif = asyncHandler(async (req, res) => {
  const actif = Boolean(req.body.actif);
  const item = await RecurringInvoice.findOne({ _id: req.params.id, owner: req.userId });
  if (!item) return res.status(404).json({ message: 'Introuvable' });
  item.actif = actif;
  // À la réactivation, on ne rattrape pas les mois passés : on repart d'aujourd'hui au plus tôt.
  if (actif && item.prochaineEmission < aujourdhuiMidi()) item.prochaineEmission = aujourdhuiMidi();
  await item.save();
  await item.populate('client', 'nom');
  res.json(item);
});

exports.deleteRecurring = asyncHandler(async (req, res) => {
  const item = await RecurringInvoice.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!item) return res.status(404).json({ message: 'Introuvable' });
  res.json({ message: 'Facture récurrente supprimée' });
});
