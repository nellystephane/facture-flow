const { z, optionalText, positiveNumber, optionalIsoDate } = require('./common');

const CATEGORIES = ['loyer', 'transport', 'materiel', 'marketing', 'salaires', 'fournitures', 'internet_telephone', 'taxes', 'autre'];
const METHODES = ['especes', 'mtn_money', 'moov_money', 'carte', 'virement', 'autre'];

const base = {
  libelle: z.string().trim().min(1, 'Le libellé est requis.').max(200),
  montant: positiveNumber('Le montant'),
  categorie: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Catégorie invalide.' }) }).default('autre'),
  date: optionalIsoDate,
  fournisseur: optionalText(200),
  methode: z.enum(METHODES, { errorMap: () => ({ message: 'Moyen de paiement invalide.' }) }).default('especes'),
  note: optionalText(1000),
};

const createExpenseSchema = z.object(base).strip();
const updateExpenseSchema = z.object(base).partial().strip();

module.exports = { createExpenseSchema, updateExpenseSchema, CATEGORIES };
