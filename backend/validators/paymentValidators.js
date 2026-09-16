const { z, objectId, optionalText, positiveNumber, optionalIsoDate } = require('./common');

const METHODES = ['especes', 'mtn_money', 'moov_money', 'carte', 'virement', 'autre'];

const createPaymentSchema = z.object({
  invoice: objectId('La facture'),
  montant: positiveNumber('Le montant'),
  methode: z.enum(METHODES).optional().default('especes'),
  date: optionalIsoDate,
  reference: optionalText(200),
  note: optionalText(1000),
}).strip();

module.exports = { createPaymentSchema };
