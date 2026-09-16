const { z, optionalText, nonNegativeNumber } = require('./common');

const serviceBase = {
  nom: z.string().trim().min(1, 'Le nom est requis.').max(200),
  description: optionalText(1000),
  prix: nonNegativeNumber('Le prix').optional().default(0),
  unite: optionalText(30).optional().default('unité'),
};

const createServiceSchema = z.object(serviceBase).strip();
const updateServiceSchema = z.object(serviceBase).partial().strip();

module.exports = { createServiceSchema, updateServiceSchema };
