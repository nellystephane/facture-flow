const mongoose = require('mongoose');

// Un document par page légale. Tant qu'aucun admin n'a rien modifié, la
// page légale correspondante affiche son contenu par défaut codé dans le
// frontend (src/pages/legal/*.tsx) — ce modèle ne sert qu'à stocker une
// SURCHARGE optionnelle, éditable depuis /admin sans toucher au code ni
// redéployer.
const legalContentSchema = new mongoose.Schema({
  slug: { type: String, enum: ['cgu', 'confidentialite', 'mentions-legales'], required: true, unique: true },
  titre: { type: String, default: '' },
  // Contenu en Markdown simple (titres avec #, paragraphes) : le frontend
  // le restitue avec une mise en forme basique. On reste volontairement en
  // texte simple plutôt qu'en HTML pour ne jamais risquer d'injection de
  // script depuis l'admin.
  contenu: { type: String, default: '' },
  modifiePar: { type: String, default: '' }, // email de l'admin qui a fait la dernière modif
}, { timestamps: true });

module.exports = mongoose.model('LegalContent', legalContentSchema);
