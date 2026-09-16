const mongoose = require('mongoose');

// Compteur atomique pour la numérotation des factures/devis. On ne se base
// JAMAIS sur un `countDocuments()` (non atomique : deux créations
// simultanées peuvent lire le même compte et produire deux fois le même
// numéro ; et un numéro redevient réutilisable dès qu'un document est
// supprimé, ce qui n'est pas acceptable pour une facture). Ce compteur est
// incrémenté via $inc, une opération atomique côté MongoDB, et n'est
// jamais décrémenté — un numéro une fois attribué n'est jamais réutilisé.
const counterSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['facture', 'devis'], required: true },
  year: { type: Number, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.index({ owner: 1, type: 1, year: 1 }, { unique: true });

const Counter = mongoose.model('Counter', counterSchema);

const PREFIX = { facture: 'FAC', devis: 'DEV' };

// Attribue et renvoie le prochain numéro, au format PREFIX-ANNEE-0001.
// La séquence repart à 1 chaque année civile (usage courant en facturation).
async function nextNumber(owner, type) {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { owner, type, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${PREFIX[type]}-${year}-${String(counter.seq).padStart(4, '0')}`;
}

module.exports = { Counter, nextNumber };
