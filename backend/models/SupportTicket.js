const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  auteurType: { type: String, enum: ['utilisateur', 'admin'], required: true },
  auteurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  auteurNom: { type: String, required: true },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
}, { timestamps: true, _id: true });

const supportTicketSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  numero: { type: String, required: true, unique: true, index: true },
  sujet: { type: String, required: true, trim: true, maxlength: 160 },
  categorie: { type: String, enum: ['question', 'paiement', 'facture', 'reversement', 'abonnement', 'bug', 'autre'], default: 'question' },
  statut: { type: String, enum: ['nouveau', 'en_cours', 'resolu', 'ferme'], default: 'nouveau', index: true },
  messages: { type: [messageSchema], default: [] },
  dernierMessagePar: { type: String, enum: ['utilisateur', 'admin'], default: 'utilisateur' },
  dernierMessageLuAdmin: { type: Boolean, default: false },
  dernierMessageLuUtilisateur: { type: Boolean, default: true },
}, { timestamps: true });

supportTicketSchema.index({ statut: 1, createdAt: -1 });
supportTicketSchema.index({ owner: 1, updatedAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
