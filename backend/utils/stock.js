'use strict';

const Invoice = require('../models/Invoice');
const Service = require('../models/Service');
const StockMovement = require('../models/StockMovement');

// Regroupe les lignes d'une facture par produit suivi (quantités cumulées).
function quantitesParProduit(items) {
  const map = new Map();
  (items || []).forEach((it) => {
    if (!it.service) return;
    const q = Number(it.quantite) || 0;
    if (q <= 0) return;
    const k = String(it.service);
    map.set(k, (map.get(k) || 0) + q);
  });
  return map;
}

async function bouger({ owner, serviceId, delta, type, invoice, note }) {
  // Seuls les produits dont le suivi est activé bougent ; le $inc est atomique.
  const service = await Service.findOneAndUpdate(
    { _id: serviceId, owner, suiviStock: true },
    { $inc: { stock: delta } },
    { returnDocument: 'after' }
  );
  if (!service) return null;
  await StockMovement.create({ owner, service: service._id, type, quantite: delta, stockApres: service.stock, invoice: invoice || null, note: note || '' });
  return service;
}

// Fait baisser le stock quand la facture quitte l'état « brouillon ».
// Idempotent : le drapeau stockApplique est pris de façon atomique, donc un
// double appel (envoi + paiement) ne retire jamais deux fois.
async function appliquerStockFacture(invoiceId) {
  const claimed = await Invoice.findOneAndUpdate(
    { _id: invoiceId, stockApplique: { $ne: true }, statut: { $nin: ['brouillon', 'annulee'] } },
    { $set: { stockApplique: true } },
    { returnDocument: 'after' }
  );
  if (!claimed) return false;
  for (const [serviceId, q] of quantitesParProduit(claimed.items)) {
    try {
      await bouger({ owner: claimed.owner, serviceId, delta: -q, type: 'facture', invoice: claimed._id, note: `Facture ${claimed.numero}` });
    } catch (err) {
      console.error('[stock] échec de mise à jour du stock', claimed.numero, err.message);
    }
  }
  return true;
}

// Remet le stock si une facture déjà appliquée est annulée.
async function restituerStockFacture(invoiceId) {
  const claimed = await Invoice.findOneAndUpdate(
    { _id: invoiceId, stockApplique: true },
    { $set: { stockApplique: false } },
    { returnDocument: 'after' }
  );
  if (!claimed) return false;
  for (const [serviceId, q] of quantitesParProduit(claimed.items)) {
    try {
      await bouger({ owner: claimed.owner, serviceId, delta: q, type: 'annulation', invoice: claimed._id, note: `Annulation ${claimed.numero}` });
    } catch (err) {
      console.error('[stock] échec de restitution du stock', claimed.numero, err.message);
    }
  }
  return true;
}

module.exports = { quantitesParProduit, bouger, appliquerStockFacture, restituerStockFacture };
