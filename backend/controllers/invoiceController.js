const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Client = require('../models/Client');
const Service = require('../models/Service');
const User = require('../models/User');
const { buildInvoicePdf } = require('../utils/pdfBuilder');
const email = require('../utils/email');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

// Génère un numéro de facture lisible : FAC-2024-0001
async function nextInvoiceNumber(owner) {
  const year = new Date().getFullYear();
  const count = await Invoice.countDocuments({ owner });
  const seq = String(count + 1).padStart(4, '0');
  return `FAC-${year}-${seq}`;
}

function paymentUrlFor(invoice) {
  const base = process.env.CLIENT_URL_PUBLIC || (process.env.CLIENT_URL || '').split(',')[0];
  if (!base || !invoice.publicToken) return null;
  return `${base.replace(/\/$/, '')}/payer/${invoice.publicToken}`;
}

const ALLOWED = ['client', 'objet', 'dateEmission', 'dateEcheance', 'items', 'remise', 'tva', 'notes', 'statut', 'template'];

function pickFields(body) {
  const o = {};
  ALLOWED.forEach((f) => { if (body[f] !== undefined) o[f] = body[f]; });
  return o;
}

exports.getInvoices = asyncHandler(async (req, res) => {
  const { statut, client } = req.query;
  const filter = { owner: req.userId };
  if (statut) filter.statut = statut;
  if (client) filter.client = client;
  const invoices = await Invoice.find(filter)
    .populate('client', 'nom entreprise email telephone')
    .sort({ createdAt: -1 });
  res.json(invoices);
});

exports.getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, owner: req.userId })
    .populate('client')
    .populate('quote');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  res.json(invoice);
});

exports.createInvoice = asyncHandler(async (req, res) => {
  const data = pickFields(req.body);
  if (!data.client) return res.status(400).json({ message: 'Le client est requis' });
  data.owner = req.userId;
  data.numero = req.body.numero || await nextInvoiceNumber(req.userId);
  const invoice = await Invoice.create(data);
  await invoice.populate('client');
  res.status(201).json(invoice);
});

exports.updateInvoice = asyncHandler(async (req, res) => {
  const updates = pickFields(req.body);
  const invoice = await Invoice.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    updates,
    { new: true }
  ).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  res.json(invoice);
});

exports.patchInvoiceStatus = asyncHandler(async (req, res) => {
  const { statut } = req.body;
  const valid = ['brouillon', 'envoyee', 'vue', 'payee', 'en_retard', 'annulee'];
  if (!valid.includes(statut)) return res.status(400).json({ message: 'Statut invalide' });
  const invoice = await Invoice.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    { statut },
    { new: true }
  ).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  res.json(invoice);
});

exports.deleteInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  await Payment.deleteMany({ invoice: invoice._id });
  res.json({ message: 'Facture supprimée' });
});

// Convertit un devis en facture
exports.createFromQuote = asyncHandler(async (req, res) => {
  const Quote = require('../models/Quote');
  const quote = await Quote.findOne({ _id: req.params.id, owner: req.userId });
  if (!quote) return res.status(404).json({ message: 'Devis introuvable' });

  const invoice = await Invoice.create({
    owner: req.userId,
    client: quote.client,
    quote: quote._id,
    numero: await nextInvoiceNumber(req.userId),
    objet: quote.objet,
    dateEmission: Date.now(),
    items: quote.items.map(i => ({ description: i.description, quantite: i.quantite, prixUnitaire: i.prixUnitaire })),
    remise: quote.remise,
    tva: quote.tva,
    notes: quote.notes,
    statut: 'brouillon'
  });
  await invoice.populate('client');
  quote.statut = 'accepte';
  await quote.save();
  res.status(201).json(invoice);
});

// -----------------------------------------------------------------------
// FONCTIONNALITÉ PREMIUM : facturer directement un client sur la base d'un
// tarif préconçu (Service), sans passer par un devis. Idéal quand le client
// demande une prestation déjà cataloguée — gain de temps immédiat.
// POST /api/invoices/from-service  { serviceId, clientId, quantite?, prixUnitaire?, dateEcheance? }
// -----------------------------------------------------------------------
exports.createFromService = asyncHandler(async (req, res) => {
  const { serviceId, clientId, quantite, prixUnitaire, dateEcheance, objet } = req.body;
  if (!serviceId || !clientId) return res.status(400).json({ message: 'Service et client requis' });

  const service = await Service.findOne({ _id: serviceId, owner: req.userId });
  if (!service) return res.status(404).json({ message: 'Tarif introuvable' });
  const client = await Client.findOne({ _id: clientId, owner: req.userId });
  if (!client) return res.status(404).json({ message: 'Client introuvable' });

  const invoice = await Invoice.create({
    owner: req.userId,
    client: clientId,
    numero: await nextInvoiceNumber(req.userId),
    objet: objet || service.nom,
    dateEmission: Date.now(),
    dateEcheance: dateEcheance || null,
    items: [{
      description: service.nom,
      quantite: quantite && quantite > 0 ? quantite : 1,
      // Prix ajustable au cas par cas pour ce client, tout en partant du tarif homogène défini.
      prixUnitaire: prixUnitaire !== undefined ? prixUnitaire : service.prix,
    }],
    statut: 'brouillon',
  });
  await invoice.populate('client');
  res.status(201).json(invoice);
});

// -----------------------------------------------------------------------
// Envoi RÉEL de la facture par email (avec PDF joint + lien de paiement).
// POST /api/invoices/:id/envoyer  { message? }
// -----------------------------------------------------------------------
exports.sendInvoiceEmail = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, owner: req.userId }).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  if (!invoice.client?.email) {
    return res.status(400).json({ message: "Ce client n'a pas d'adresse email enregistrée." });
  }

  const user = await User.findById(req.userId);
  const paymentUrl = paymentUrlFor(invoice);
  const pdfBuffer = await buildInvoicePdf({ invoice, user, paymentUrl });

  try {
    await email.sendInvoiceEmail({ to: invoice.client.email, invoice, user, pdfBuffer, paymentUrl });
  } catch (err) {
    if (err.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(503).json({
        message: "L'envoi d'email n'est pas configuré côté serveur. Ajoutez les variables BREVO_SMTP_* dans backend/.env.",
        code: 'EMAIL_NOT_CONFIGURED',
      });
    }
    return res.status(502).json({ message: "Échec de l'envoi de l'email : " + err.message });
  }

  if (invoice.statut === 'brouillon') invoice.statut = 'envoyee';
  invoice.dateEnvoi = new Date();
  await invoice.save();

  res.json({ message: 'Facture envoyée par email.', invoice, paymentUrl });
});
