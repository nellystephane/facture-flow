const crypto = require('crypto');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { sendMail, sendSupportTicketNotification, sendSupportReplyNotification } = require('../utils/email');

const CONTACT_EMAIL = process.env.SUPPORT_EMAIL || 'contact@emgdigitalsolutions.bj';

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

function nextNumero() {
  // Identifiant court et non séquentiel : évite les collisions lorsque
  // plusieurs demandes arrivent exactement en même temps.
  return `SUP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

exports.listMine = asyncHandler(async (req, res) => {
  const tickets = await SupportTicket.find({ owner: req.userId })
    .select('numero sujet categorie statut dernierMessagePar createdAt updatedAt messages')
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
  res.json({ tickets });
});

exports.create = asyncHandler(async (req, res) => {
  const sujet = clean(req.body.sujet, 160);
  const message = clean(req.body.message, 5000);
  const categorie = clean(req.body.categorie || 'question', 30);
  const categories = ['question', 'paiement', 'facture', 'reversement', 'abonnement', 'bug', 'autre'];
  if (!sujet || !message) return res.status(400).json({ message: 'Sujet et message requis.' });
  if (!categories.includes(categorie)) return res.status(400).json({ message: 'Catégorie invalide.' });

  const user = await User.findById(req.actorId).select('nom email entreprise');
  if (!user) return res.status(401).json({ message: 'Compte introuvable.' });

  const ticket = await SupportTicket.create({
    owner: req.userId,
    createdBy: req.actorId,
    numero: nextNumero(),
    sujet,
    categorie,
    statut: 'nouveau',
    dernierMessagePar: 'utilisateur',
    dernierMessageLuAdmin: false,
    dernierMessageLuUtilisateur: true,
    messages: [{ auteurType: 'utilisateur', auteurId: req.actorId, auteurNom: user.nom, message }],
  });

  // L'email est une notification complémentaire : le ticket reste la source
  // de vérité dans MongoDB. Une panne SMTP ne doit jamais annuler la demande.
  sendSupportTicketNotification({
    to: CONTACT_EMAIL,
    ticket,
    user,
  }).catch((err) => console.error('[support] notification email impossible:', err.message));

  res.status(201).json({ ticket });
});

exports.getMine = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findOne({ _id: req.params.id, owner: req.userId }).lean();
  if (!ticket) return res.status(404).json({ message: 'Demande introuvable.' });
  await SupportTicket.updateOne({ _id: ticket._id, owner: req.userId }, { $set: { dernierMessageLuUtilisateur: true } });
  ticket.dernierMessageLuUtilisateur = true;
  res.json({ ticket });
});

exports.replyMine = asyncHandler(async (req, res) => {
  const message = clean(req.body.message, 5000);
  if (!message) return res.status(400).json({ message: 'Message requis.' });

  const user = await User.findById(req.actorId).select('nom');
  const ticket = await SupportTicket.findOne({ _id: req.params.id, owner: req.userId });
  if (!ticket) return res.status(404).json({ message: 'Demande introuvable.' });
  if (ticket.statut === 'ferme') return res.status(409).json({ message: 'Cette demande est fermée. Créez une nouvelle demande si nécessaire.' });

  ticket.messages.push({ auteurType: 'utilisateur', auteurId: req.actorId, auteurNom: user?.nom || req.actorNom, message });
  ticket.dernierMessagePar = 'utilisateur';
  ticket.dernierMessageLuAdmin = false;
  ticket.dernierMessageLuUtilisateur = true;
  if (ticket.statut === 'resolu') ticket.statut = 'en_cours';
  await ticket.save();

  sendSupportTicketNotification({
    to: CONTACT_EMAIL,
    ticket,
    user: await User.findById(req.actorId).select('nom email entreprise'),
    isFollowUp: true,
  }).catch((err) => console.error('[support] notification email impossible:', err.message));

  res.json({ ticket });
});

// ===== Espace administrateur =====
exports.adminList = asyncHandler(async (req, res) => {
  const { statut = '', page = 1, limite = 30 } = req.query;
  const filtre = statut ? { statut } : {};
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limite, 10) || 30));
  const [tickets, total, nonLus] = await Promise.all([
    SupportTicket.find(filtre)
      .populate('owner', 'nom email entreprise')
      .sort({ dernierMessageLuAdmin: 1, updatedAt: -1 })
      .skip((p - 1) * l).limit(l).lean(),
    SupportTicket.countDocuments(filtre),
    SupportTicket.countDocuments({ dernierMessagePar: 'utilisateur', dernierMessageLuAdmin: false, statut: { $ne: 'ferme' } }),
  ]);
  res.json({ tickets, total, page: p, pages: Math.ceil(total / l), nonLus });
});

exports.adminUnreadCount = asyncHandler(async (req, res) => {
  const count = await SupportTicket.countDocuments({ dernierMessagePar: 'utilisateur', dernierMessageLuAdmin: false, statut: { $ne: 'ferme' } });
  res.json({ count });
});

exports.adminGet = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id).populate('owner', 'nom email entreprise').lean();
  if (!ticket) return res.status(404).json({ message: 'Demande introuvable.' });
  await SupportTicket.updateOne({ _id: ticket._id }, { $set: { dernierMessageLuAdmin: true } });
  ticket.dernierMessageLuAdmin = true;
  res.json({ ticket });
});

exports.adminReply = asyncHandler(async (req, res) => {
  const message = clean(req.body.message, 5000);
  const statut = clean(req.body.statut || 'en_cours', 30);
  if (!message) return res.status(400).json({ message: 'Message requis.' });
  if (!['en_cours', 'resolu', 'ferme'].includes(statut)) return res.status(400).json({ message: 'Statut invalide.' });

  const ticket = await SupportTicket.findById(req.params.id).populate('owner', 'nom email entreprise');
  if (!ticket) return res.status(404).json({ message: 'Demande introuvable.' });

  ticket.messages.push({ auteurType: 'admin', auteurNom: 'Support Oryxa', message });
  ticket.dernierMessagePar = 'admin';
  ticket.dernierMessageLuUtilisateur = false;
  ticket.dernierMessageLuAdmin = true;
  ticket.statut = statut;
  await ticket.save();

  sendSupportReplyNotification({ to: ticket.owner.email, ticket }).catch((err) => console.error('[support] réponse email impossible:', err.message));
  res.json({ ticket });
});

exports.adminSetStatus = asyncHandler(async (req, res) => {
  const statut = clean(req.body.statut, 30);
  if (!['nouveau', 'en_cours', 'resolu', 'ferme'].includes(statut)) return res.status(400).json({ message: 'Statut invalide.' });
  const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { statut, dernierMessageLuAdmin: true }, { new: true })
    .populate('owner', 'nom email entreprise');
  if (!ticket) return res.status(404).json({ message: 'Demande introuvable.' });
  res.json({ ticket });
});

module.exports.CONTACT_EMAIL = CONTACT_EMAIL;
