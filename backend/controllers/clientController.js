const Client = require('../models/Client');
const { paginationParams, paginatedResponse } = require('../utils/pagination');

const asyncHandler = require('../middleware/asyncHandler');
const { verifierLimiteClients } = require('../utils/permissions');

exports.getClients = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { owner: req.userId };
  if (req.query.q) {
    const re = new RegExp(req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ nom: re }, { entreprise: re }, { email: re }];
  }
  const [items, total] = await Promise.all([
    Client.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Client.countDocuments(filter),
  ]);
  res.json(paginatedResponse(items, total, page, limit));
});

exports.getClientById = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, owner: req.userId });
  if (!client) return res.status(404).json({ message: 'Client introuvable' });
  res.json(client);
});

// Fiche client : synthèse commerciale + historique des documents et paiements.
exports.getClientHistorique = asyncHandler(async (req, res) => {
  const Invoice = require('../models/Invoice');
  const Quote = require('../models/Quote');
  const Payment = require('../models/Payment');
  const { PAID_PAYMENT_FILTER } = require('../utils/invoiceTotals');
  const { summarizeClient } = require('../utils/clientHistory');

  const client = await Client.findOne({ _id: req.params.id, owner: req.userId });
  if (!client) return res.status(404).json({ message: 'Client introuvable' });

  const invoices = await Invoice.find({ owner: req.userId, client: client._id })
    .select('numero statut dateEmission dateEcheance devise tauxChange items remise tva fiscalisation.status fiscalisation.dgiTotal')
    .sort({ dateEmission: -1 }).limit(500).lean();
  const ids = invoices.map((i) => i._id);
  const [payments, quotes] = await Promise.all([
    ids.length ? Payment.find({ owner: req.userId, invoice: { $in: ids }, ...PAID_PAYMENT_FILTER }).sort({ date: -1 }).limit(500).lean() : [],
    Quote.find({ owner: req.userId, client: client._id }).select('numero statut dateEmission items remise tva').sort({ dateEmission: -1 }).limit(50).lean(),
  ]);

  const synthese = summarizeClient({ invoices, payments });
  const numeroParId = Object.fromEntries(invoices.map((i) => [String(i._id), i.numero]));
  res.json({
    client,
    synthese,
    paiements: payments.slice(0, 30).map((p) => ({
      _id: p._id, date: p.date, devise: p.devise || 'XOF', montant: p.montantFacture ?? p.montant, methode: p.methode, origine: p.origine,
      invoice: p.invoice, factureNumero: numeroParId[String(p.invoice)] || '',
    })),
    devis: quotes.map((q) => ({ _id: q._id, numero: q.numero, statut: q.statut, dateEmission: q.dateEmission })),
  });
});

exports.createClient = asyncHandler(async (req, res) => {
  const user = await require('../models/User').findById(req.userId);
  const limite = await verifierLimiteClients(Client, user);
  if (limite) return res.status(403).json(limite);
  const { nom, entreprise, email, telephone, whatsapp, adresse, notes } = req.body;
  if (!nom) return res.status(400).json({ message: 'Le nom du client est requis' });
  const client = await Client.create({
    nom, entreprise, email, telephone, whatsapp, adresse, notes, owner: req.userId
  });
  res.status(201).json(client);
});

exports.updateClient = asyncHandler(async (req, res) => {
  const allowed = ['nom', 'entreprise', 'email', 'telephone', 'whatsapp', 'adresse', 'notes'];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const client = await Client.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    updates,
    { returnDocument: 'after' }
  );
  if (!client) return res.status(404).json({ message: 'Client introuvable' });
  res.json(client);
});

exports.deleteClient = asyncHandler(async (req, res) => {
  const client = await Client.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!client) return res.status(404).json({ message: 'Client introuvable' });
  res.json({ message: 'Client supprimé' });
});
