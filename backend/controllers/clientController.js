const Client = require('../models/Client');
const { paginationParams, paginatedResponse } = require('../utils/pagination');

const asyncHandler = require('../middleware/asyncHandler');
const { verifierLimiteClients } = require('../utils/permissions');

exports.getClients = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { owner: req.userId };
  if (req.query.q) {
    const re = new RegExp(req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ nom: re }, { entreprise: re }, { email: re }];
  }
  const [items, total] = await Promise.all([
    Client.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Client.countDocuments(filter),
  ]);
  res.json(paginatedResponse(items, total, page, limit));
});

exports.getClientById = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, owner: req.userId });
  if (!client) return res.status(404).json({ message: 'Client introuvable' });
  res.json(client);
});

exports.createClient = asyncHandler(async (req, res) => {
  const user = await require('../models/User').findById(req.userId);
  const limite = await verifierLimiteClients(Client, user);
  if (limite) return res.status(403).json(limite);
  const { nom, entreprise, email, telephone, whatsapp, adresse, notes } = req.body;
  if (!nom) return res.status(400).json({ message: 'Le nom du client est requis' });
  const client = await Client.create({
    nom, entreprise, email, telephone, whatsapp, adresse, notes, owner: req.userId
  });
  res.status(201).json(client);
});

exports.updateClient = asyncHandler(async (req, res) => {
  const allowed = ['nom', 'entreprise', 'email', 'telephone', 'whatsapp', 'adresse', 'notes'];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const client = await Client.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    updates,
    { new: true }
  );
  if (!client) return res.status(404).json({ message: 'Client introuvable' });
  res.json(client);
});

exports.deleteClient = asyncHandler(async (req, res) => {
  const client = await Client.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!client) return res.status(404).json({ message: 'Client introuvable' });
  res.json({ message: 'Client supprimé' });
});
