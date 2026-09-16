const { z } = require('zod');

// Identifiant Mongo (24 caractères hexadécimaux) — utilisé pour toute
// référence à un autre document (client, facture, devis...).
const objectId = (label = 'Identifiant') =>
  z.string().regex(/^[0-9a-fA-F]{24}$/, `${label} invalide.`);

// Chaîne "texte libre" optionnelle : accepte undefined, null ou chaîne vide,
// et convertit toujours en chaîne trim() (jamais null/undefined en sortie),
// pour matcher les valeurs par défaut '' des modèles Mongoose.
const optionalText = (max = 2000) =>
  z.preprocess(
    (val) => (val === null ? undefined : val),
    z.string().trim().max(max, `Ne doit pas dépasser ${max} caractères.`).optional().default('')
  );

const email = z.string().trim().toLowerCase().email('Adresse email invalide.');
const optionalEmail = z.union([email, z.literal('')]).optional();

const nonNegativeNumber = (label) =>
  z.coerce.number({ invalid_type_error: `${label} doit être un nombre.` }).min(0, `${label} ne peut pas être négatif.`);

const positiveNumber = (label) =>
  z.coerce.number({ invalid_type_error: `${label} doit être un nombre.` }).positive(`${label} doit être supérieur à 0.`);

const isoDate = z.coerce.date({ invalid_type_error: 'Date invalide.' });
// Normalise '', null et undefined en "pas de date fournie" plutôt que de
// laisser passer une chaîne vide jusqu'à Mongoose, qui la rejetterait avec
// une erreur de cast peu claire.
const optionalIsoDate = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  isoDate.optional()
);

module.exports = { z, objectId, optionalText, email, optionalEmail, nonNegativeNumber, positiveNumber, isoDate, optionalIsoDate };
