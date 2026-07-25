const Service = require('../models/Service');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

exports.getServices = asyncHandler(async (req, res) => {
  const services = await Service.find({ owner: req.userId }).sort({ createdAt: -1 });
  res.json(services);
});

exports.getServiceById = asyncHandler(async (req, res) => {
  const service = await Service.findOne({ _id: req.params.id, owner: req.userId });
  if (!service) return res.status(404).json({ message: 'Service introuvable' });
  res.json(service);
});

exports.createService = asyncHandler(async (req, res) => {
  const { nom, description, prix, unite } = req.body;
  if (!nom) return res.status(400).json({ message: 'Le nom est requis' });
  const service = await Service.create({
    nom, description, prix, unite, owner: req.userId
  });
  res.status(201).json(service);
});

exports.updateService = asyncHandler(async (req, res) => {
  const allowed = ['nom', 'description', 'prix', 'unite'];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const service = await Service.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    updates,
    { new: true }
  );
  if (!service) return res.status(404).json({ message: 'Service introuvable' });
  res.json(service);
});

exports.deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!service) return res.status(404).json({ message: 'Service introuvable' });
  res.json({ message: 'Service supprimé' });
});
