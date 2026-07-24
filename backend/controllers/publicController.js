const mongoose = require('mongoose');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

// Petit cache mémoire (60s) pour éviter de recalculer à chaque appel de la landing page
let cache = { data: null, expiresAt: 0 };
const CACHE_TTL_MS = 60 * 1000;

/**
 * GET /api/public/stats
 * Statistiques 100% réelles et calculées automatiquement à partir de la base
 * de données (aucune valeur fictive). Utilisées sur la page d'accueil.
 * Ne renvoie que des agrégats anonymes — jamais de données par utilisateur.
 */
exports.getPublicStats = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    // Base indisponible : on répond avec des compteurs à zéro plutôt que d'inventer des chiffres.
    return res.json({ totalUtilisateurs: 0, totalFactures: 0, totalEncaisse: 0, ready: false });
  }

  const now = Date.now();
  if (cache.data && cache.expiresAt > now) {
    return res.json(cache.data);
  }

  const [totalUtilisateurs, totalFactures, encaisseAgg] = await Promise.all([
    User.countDocuments(),
    Invoice.countDocuments(),
    Payment.aggregate([{ $group: { _id: null, total: { $sum: '$montant' } } }]),
  ]);

  const data = {
    totalUtilisateurs,
    totalFactures,
    totalEncaisse: Math.round(encaisseAgg[0]?.total || 0),
    ready: true,
  };

  cache = { data, expiresAt: now + CACHE_TTL_MS };
  res.json(data);
});
