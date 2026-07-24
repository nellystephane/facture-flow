const Client = require('../models/Client');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

exports.getClients = asyncHandler(async (req, res) => {
  const clients = await Client.find({ owner: req.userId }).sort({ createdAt: -1 });
  res.json(clients);
});

exports.getClientById = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, owner: req.userId });
  if (!client) return res.status(404).json({ message: 'Client introuvable' });
  res.json(client);
});

exports.createClient = asyncHandler(async (req, res) => {
  const { nom, entreprise, email, telephone, adresse, notes } = req.body;
  if (!nom) return res.status(400).json({ message: 'Le nom du client est requis' });
  const client = await Client.create({
    nom, entreprise, email, telephone, adresse, notes, owner: req.userId
  });
  res.status(201).json(client);
});

exports.updateClient = asyncHandler(async (req, res) => {
  const allowed = ['nom', 'entreprise', 'email', 'telephone', 'adresse', 'notes'];
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
