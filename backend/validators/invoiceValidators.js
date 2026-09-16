const { z, objectId, optionalText, nonNegativeNumber, positiveNumber, optionalIsoDate } = require('./common');

const itemSchema = z.object({
  description: z.string().trim().min(1, 'La description est requise.').max(500),
  quantite: positiveNumber('La quantité'),
  prixUnitaire: nonNegativeNumber('Le prix unitaire'),
}).strip();

// Le statut d'une facture reflète des actions réelles (envoi effectif de
// l'email, ouverture par le client, paiement reçu, retard détecté
// automatiquement) — jamais une valeur choisie librement par le client de
// l'API. La seule transition manuelle légitime est l'annulation, avec
// confirmation explicite côté interface (voir InvoiceDetail.tsx).
const invoiceBase = {
  client: objectId('Le client'),
  objet: optionalText(300),
  dateEmission: optionalIsoDate,
  dateEcheance: optionalIsoDate,
  items: z.array(itemSchema).min(1, 'Au moins un article est requis.'),
  remise: nonNegativeNumber('La remise').optional().default(0),
  tva: nonNegativeNumber('La TVA').max(100, 'La TVA ne peut pas dépasser 100%.').optional().default(0),
  notes: optionalText(2000),
  template: z.enum(['classique', 'moderne', 'minimal']).optional(),
};

const createInvoiceSchema = z.object(invoiceBase).strip();
const updateInvoiceSchema = z.object(invoiceBase).partial().strip();
const patchInvoiceStatusSchema = z.object({
  statut: z.literal('annulee', { errorMap: () => ({ message: "Seule l'annulation peut être déclenchée manuellement." }) }),
}).strip();

module.exports = { createInvoiceSchema, updateInvoiceSchema, patchInvoiceStatusSchema };
