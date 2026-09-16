const { z, optionalText, optionalEmail } = require('./common');

const clientBase = {
  nom: z.string().trim().min(1, 'Le nom du client est requis.').max(200),
  entreprise: optionalText(200),
  email: optionalEmail,
  telephone: optionalText(30),
  adresse: optionalText(300),
  notes: optionalText(2000),
};

// .partial() sur update : chaque champ redevient optionnel (mise à jour
// partielle), mais garde les mêmes règles de format quand il est fourni.
const createClientSchema = z.object(clientBase).strip();
const updateClientSchema = z.object(clientBase).partial().strip();

module.exports = { createClientSchema, updateClientSchema };
