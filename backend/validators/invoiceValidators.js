const { z, objectId, optionalText, nonNegativeNumber, positiveNumber, optionalIsoDate } = require('./common');

const itemSchema = z.object({
  description: z.string().trim().min(1, 'La description est requise.').max(500),
  quantite: positiveNumber('La quantité'),
  prixUnitaire: nonNegativeNumber('Le prix unitaire'),
}).strip();

const STATUTS = ['brouillon', 'envoyee', 'vue', 'payee', 'en_retard', 'annulee'];

const invoiceBase = {
  client: objectId('Le client'),
  objet: optionalText(300),
  dateEmission: optionalIsoDate,
  dateEcheance: optionalIsoDate,
  items: z.array(itemSchema).min(1, 'Au moins un article est requis.'),
  remise: nonNegativeNumber('La remise').optional().default(0),
  tva: nonNegativeNumber('La TVA').max(100, 'La TVA ne peut pas dépasser 100%.').optional().default(0),
  notes: optionalText(2000),
  statut: z.enum(STATUTS).optional(),
  template: z.enum(['classique', 'moderne', 'minimal']).optional(),
};

const createInvoiceSchema = z.object(invoiceBase).strip();
const updateInvoiceSchema = z.object(invoiceBase).partial().strip();
const patchInvoiceStatusSchema = z.object({
  statut: z.enum(STATUTS, { errorMap: () => ({ message: 'Statut invalide.' }) }),
}).strip();

module.exports = { createInvoiceSchema, updateInvoiceSchema, patchInvoiceStatusSchema };
