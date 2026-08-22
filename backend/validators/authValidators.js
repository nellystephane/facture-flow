const { z, optionalText } = require('./common');

const banqueSchema = z.object({
  nomBanque: optionalText(100),
  titulaire: optionalText(150),
  iban: optionalText(50),
  rib: optionalText(50),
  swift: optionalText(20),
}).strip().optional();

const updateProfileSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est requis.').max(150).optional(),
  entreprise: optionalText(200),
  telephone: optionalText(30),
  adresse: optionalText(300),
  devise: optionalText(10),
  banque: banqueSchema,
}).strip();

module.exports = { updateProfileSchema };
