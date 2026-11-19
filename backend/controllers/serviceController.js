const Service = require('../models/Service');
const StockMovement = require('../models/StockMovement');
const User = require('../models/User');
const { permissionsDe } = require('../utils/permissions');
const { bouger } = require('../utils/stock');


const asyncHandler = require('../middleware/asyncHandler');

// Unités courantes proposées par défaut à tous les comptes. Une unité tapée
// librement par l'utilisateur (ex: "sac", "trajet") est automatiquement
// mémorisée pour lui dès qu'il l'utilise sur un service : voir getUnites,
// qui la retrouve simplement en interrogeant ses propres services (pas de
// table séparée à maintenir, la source de vérité est directement l'usage réel).
const UNITES_PAR_DEFAUT = ['unité', 'heure', 'jour', 'mois', 'm²', 'km', 'kg', 'forfait', 'pièce'];

exports.getUnites = asyncHandler(async (req, res) => {
  const utilisees = await Service.distinct('unite', { owner: req.userId });
  const toutes = [...new Set([...UNITES_PAR_DEFAUT, ...utilisees.filter(Boolean)])];
  res.json({ unites: toutes });
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

async function stockInterdit(req, res) {
  if (!req.body.suiviStock) return false;
  const user = await User.findById(req.userId);
  if (permissionsDe(user).peutGererStock()) return false;
  res.status(403).json({ message: 'La gestion de stock est réservée aux plans Pro et Business.', code: 'FEATURE_LOCKED', feature: 'gestionStock' });
  return true;
}

exports.createService = asyncHandler(async (req, res) => {
  const { nom, description, prix, unite, suiviStock, stock, seuilAlerte, prixAchat } = req.body;
  if (!nom) return res.status(400).json({ message: 'Le nom est requis' });
  if (await stockInterdit(req, res)) return;
  const service = await Service.create({
    nom, description, prix, unite, owner: req.userId,
    ...(suiviStock ? { suiviStock: true, stock: Number(stock) || 0, seuilAlerte: seuilAlerte || 0, prixAchat: prixAchat || 0 } : {}),
  });
  if (service.suiviStock && service.stock !== 0) {
    await StockMovement.create({ owner: req.userId, service: service._id, type: 'ajustement', quantite: service.stock, stockApres: service.stock, note: 'Stock initial' });
  }
  res.status(201).json(service);
});

exports.updateService = asyncHandler(async (req, res) => {
  const allowed = ['nom', 'description', 'prix', 'unite', 'suiviStock', 'seuilAlerte', 'prixAchat'];
  if (await stockInterdit(req, res)) return;
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const service = await Service.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    updates,
    { returnDocument: 'after' }
  );
  if (!service) return res.status(404).json({ message: 'Service introuvable' });
  res.json(service);
});

// POST /api/services/:id/stock  { type: 'entree'|'sortie'|'ajustement', quantite, note? }
// entree/sortie : quantité positive ajoutée/retirée ; ajustement : nouveau stock réel compté.
exports.mouvementStock = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!permissionsDe(user).peutGererStock()) {
    return res.status(403).json({ message: 'La gestion de stock est réservée aux plans Pro et Business.', code: 'FEATURE_LOCKED', feature: 'gestionStock' });
  }
  const { type, quantite, note } = req.body;
  const q = Number(quantite);
  if (!['entree', 'sortie', 'ajustement'].includes(type)) return res.status(400).json({ message: 'Type de mouvement invalide.' });
  if (!Number.isFinite(q) || q < 0 || (type !== 'ajustement' && q === 0)) return res.status(400).json({ message: 'Quantité invalide.' });
  const service = await Service.findOne({ _id: req.params.id, owner: req.userId, suiviStock: true });
  if (!service) return res.status(404).json({ message: 'Produit introuvable ou sans suivi de stock.' });
  const delta = type === 'entree' ? q : type === 'sortie' ? -q : q - service.stock;
  if (type === 'sortie' && service.stock - q < 0) return res.status(400).json({ message: `Stock insuffisant (${service.stock} en stock).` });
  const maj = await bouger({ owner: req.userId, serviceId: service._id, delta, type, note: String(note || '').slice(0, 200) });
  res.json(maj);
});

exports.getMouvements = asyncHandler(async (req, res) => {
  const mouvements = await StockMovement.find({ owner: req.userId, service: req.params.id }).sort({ date: -1 }).limit(100);
  res.json(mouvements);
});

// Valeur du stock, produits en alerte, produits épuisés.
exports.getStockResume = asyncHandler(async (req, res) => {
  const produits = await Service.find({ owner: req.userId, suiviStock: true }).select('nom stock seuilAlerte prixAchat prix unite').lean();
  const enAlerte = produits.filter((p) => p.stock > 0 && p.stock <= p.seuilAlerte);
  const epuises = produits.filter((p) => p.stock <= 0);
  res.json({
    nombreProduits: produits.length,
    valeurAchat: Math.round(produits.reduce((s, p) => s + Math.max(0, p.stock) * (p.prixAchat || 0), 0)),
    valeurVente: Math.round(produits.reduce((s, p) => s + Math.max(0, p.stock) * (p.prix || 0), 0)),
    enAlerte: enAlerte.map((p) => ({ _id: p._id, nom: p.nom, stock: p.stock, seuilAlerte: p.seuilAlerte, unite: p.unite })),
    epuises: epuises.map((p) => ({ _id: p._id, nom: p.nom, stock: p.stock, unite: p.unite })),
  });
});

exports.deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!service) return res.status(404).json({ message: 'Service introuvable' });
  res.json({ message: 'Service supprimé' });
});
