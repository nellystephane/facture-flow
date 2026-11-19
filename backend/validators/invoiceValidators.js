const { z, objectId, optionalText, nonNegativeNumber, positiveNumber, optionalIsoDate } = require('./common');

const itemSchema = z.object({
  description: z.string().trim().min(1, 'La description est requise.').max(500),
  quantite: positiveNumber('La quantité'),
  prixUnitaire: nonNegativeNumber('Le prix unitaire'),
  taxGroup: z.enum(['A', 'B', 'C', 'D', 'E', 'F']).nullable().optional(),
  taxSpecific: nonNegativeNumber('La taxe spécifique').optional().default(0),
  originalPrice: positiveNumber('Le prix d’origine').nullable().optional(),
  priceModification: optionalText(100),
  service: objectId('Le produit').nullable().optional(),
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
  devise: z.string().trim().max(10).optional(),
  tauxChange: z.coerce.number().positive('Le taux de change doit être positif.').optional(),
  fraisSupportesPar: z.enum(['utilisateur', 'client']).optional(),
  template: z.enum(['classique', 'moderne', 'minimal', 'atelier', 'horizon', 'prestige', 'corporate', 'signature', 'noir']).optional(),
};

const createInvoiceSchema = z.object(invoiceBase).strip();
const updateInvoiceSchema = z.object(invoiceBase).partial().strip();
const patchInvoiceStatusSchema = z.object({
  statut: z.literal('annulee', { errorMap: () => ({ message: "Seule l'annulation peut être déclenchée manuellement." }) }),
}).strip();

const venteRapideSchema = z.object({
  items: z.array(itemSchema).min(1, 'Au moins un article est requis.'),
  methode: z.enum(['especes', 'mtn_money', 'moov_money', 'carte', 'virement', 'autre']).optional(),
  client: objectId('Le client').optional(),
  remise: nonNegativeNumber('La remise').optional().default(0),
  tva: nonNegativeNumber('La TVA').max(100).optional().default(0),
}).strip();

module.exports = { createInvoiceSchema, updateInvoiceSchema, patchInvoiceStatusSchema, venteRapideSchema };
