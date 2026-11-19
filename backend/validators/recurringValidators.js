const { z, objectId, optionalText, nonNegativeNumber, positiveNumber, optionalIsoDate } = require('./common');

const item = z.object({
  description: z.string().trim().min(1, 'La description est requise.').max(500),
  quantite: positiveNumber('La quantité'),
  prixUnitaire: nonNegativeNumber('Le prix unitaire'),
  service: objectId('Le produit').nullable().optional(),
}).strip();

const base = {
  client: objectId('Le client'),
  titre: z.string().trim().min(1, 'Donnez un nom à cette facture récurrente.').max(150),
  objet: optionalText(300),
  items: z.array(item).min(1, 'Au moins un article est requis.'),
  remise: nonNegativeNumber('La remise').optional().default(0),
  devise: z.string().trim().max(10).optional(),
  tauxChange: z.coerce.number().positive('Le taux de change doit être positif.').optional(),
  tva: nonNegativeNumber('La TVA').max(100).optional().default(0),
  notes: optionalText(2000),
  fraisSupportesPar: z.enum(['utilisateur', 'client']).optional(),
  frequence: z.enum(['hebdomadaire', 'mensuelle', 'trimestrielle', 'annuelle']),
  prochaineEmission: z.string().min(1, 'La date de première facture est requise.'),
  dateFin: optionalIsoDate,
  delaiEcheanceJours: nonNegativeNumber('Le délai').max(365).optional().default(15),
  envoiAutomatique: z.boolean().optional().default(false),
};

const createRecurringSchema = z.object(base).strip();
const updateRecurringSchema = z.object(base).partial().strip();
module.exports = { createRecurringSchema, updateRecurringSchema };
