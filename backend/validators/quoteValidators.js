const { z, objectId, optionalText, nonNegativeNumber, positiveNumber, optionalIsoDate } = require('./common');

const itemSchema = z.object({
  description: z.string().trim().min(1, 'La description est requise.').max(500),
  quantite: positiveNumber('La quantité'),
  prixUnitaire: nonNegativeNumber('Le prix unitaire'),
}).strip();

const STATUTS = ['brouillon', 'envoye', 'accepte', 'refuse', 'expire'];

const quoteBase = {
  client: objectId('Le client'),
  objet: optionalText(300),
  dateEmission: optionalIsoDate,
  dateExpiration: optionalIsoDate,
  items: z.array(itemSchema).min(1, 'Au moins un article est requis.'),
  remise: nonNegativeNumber('La remise').optional().default(0),
  tva: nonNegativeNumber('La TVA').max(100, 'La TVA ne peut pas dépasser 100%.').optional().default(0),
  notes: optionalText(2000),
  statut: z.enum(STATUTS).optional(),
};

const createQuoteSchema = z.object(quoteBase).strip();
const updateQuoteSchema = z.object(quoteBase).partial().strip();
const patchQuoteStatusSchema = z.object({
  statut: z.enum(STATUTS, { errorMap: () => ({ message: 'Statut invalide.' }) }),
}).strip();

module.exports = { createQuoteSchema, updateQuoteSchema, patchQuoteStatusSchema };
