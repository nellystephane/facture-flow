const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Client = require('../models/Client');
const Service = require('../models/Service');
const User = require('../models/User');
const { nextNumber } = require('../models/Counter');
const { paginationParams, paginatedResponse } = require('../utils/pagination');
const { buildInvoicePdf } = require('../utils/pdfBuilder');
const { permissionsDe, verifierLimiteFactures } = require('../utils/permissions');
const { enregistrerActivite } = require('../utils/activityLog');
const email = require('../utils/email');

const asyncHandler = require('../middleware/asyncHandler');

// Le numéro de facture n'est JAMAIS accepté depuis le client (voir
// models/Counter.js) : c'est un document légal, sa numérotation doit être
// infalsifiable, séquentielle et jamais réattribuée.
const nextInvoiceNumber = (owner) => nextNumber(owner, 'facture');

// Une fois qu'une facture est sortie de l'état "brouillon", elle constitue
// un document légal envoyé/vu/payé par le client : on ne l'édite plus et on
// ne la supprime plus. On l'annule (statut "annulee") si besoin, on ne la
// falsifie pas après coup.
const MODIFIABLE_STATUTS = ['brouillon'];

function paymentUrlFor(invoice) {
  const base = process.env.CLIENT_URL_PUBLIC || (process.env.CLIENT_URL || '').split(',')[0];
  if (!base || !invoice.publicToken) return null;
  return `${base.replace(/\/$/, '')}/payer/${invoice.publicToken}`;
}

// -----------------------------------------------------------------------
// Limite de factures/mois : voir config/plans.js (source unique de vérité)
// et utils/permissions.js pour la logique de vérification.
async function verifierLimiteGratuite(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  return verifierLimiteFactures(Invoice, user);
}

const ALLOWED = ['client', 'objet', 'dateEmission', 'dateEcheance', 'items', 'remise', 'tva', 'notes', 'statut', 'template'];

function pickFields(body) {
  const o = {};
  ALLOWED.forEach((f) => { if (body[f] !== undefined) o[f] = body[f]; });
  return o;
}

exports.getInvoices = asyncHandler(async (req, res) => {
  const { statut, client, q } = req.query;
  const { page, limit, skip } = paginationParams(req.query);
  const filter = { owner: req.userId };
  if (statut) filter.statut = statut;
  if (client) filter.client = client;
  if (q && q.trim()) {
    const re = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matchingClients = await Client.find({ owner: req.userId, nom: re }).select('_id');
    filter.$or = [{ numero: re }, { client: { $in: matchingClients.map((c) => c._id) } }];
  }
  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .populate('client', 'nom entreprise email telephone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(filter),
  ]);
  res.json(paginatedResponse(items, total, page, limit));
});

exports.getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, owner: req.userId })
    .populate('client')
    .populate('quote');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  res.json(invoice);
});

exports.createInvoice = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  const limite = await verifierLimiteFactures(Invoice, user);
  if (limite) return res.status(403).json(limite);

  const data = pickFields(req.body);
  if (!data.client) return res.status(400).json({ message: 'Le client est requis' });
  data.owner = req.userId;
  data.numero = await nextInvoiceNumber(req.userId);
  if (data.template && !permissionsDe(user).peutUtiliserModele(data.template)) {
    data.template = 'classique';
  }
  const invoice = await Invoice.create(data);
  await invoice.populate('client');
  enregistrerActivite(req, { action: 'facture.creee', ressource: 'facture', ressourceId: invoice._id, details: `Facture ${invoice.numero} créée` });
  res.status(201).json(invoice);
});

exports.updateInvoice = asyncHandler(async (req, res) => {
  const existing = await Invoice.findOne({ _id: req.params.id, owner: req.userId });
  if (!existing) return res.status(404).json({ message: 'Facture introuvable' });
  if (!MODIFIABLE_STATUTS.includes(existing.statut)) {
    return res.status(409).json({
      message: "Cette facture a déjà été envoyée : elle ne peut plus être modifiée. Annulez-la (statut « Annulée ») puis créez-en une nouvelle si besoin.",
      code: 'INVOICE_NOT_EDITABLE',
    });
  }
  const updates = pickFields(req.body);
  if (updates.template) {
    const user = await User.findById(req.userId);
    if (!permissionsDe(user).peutUtiliserModele(updates.template)) {
      updates.template = 'classique';
    }
  }
  const invoice = await Invoice.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    updates,
    { new: true }
  ).populate('client');
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
  enregistrerActivite(req, { action: 'facture.statut', ressource: 'facture', ressourceId: invoice._id, details: `Facture ${invoice.numero} → ${statut}` });
  res.json(invoice);
});

exports.deleteInvoice = asyncHandler(async (req, res) => {
  const existing = await Invoice.findOne({ _id: req.params.id, owner: req.userId });
  if (!existing) return res.status(404).json({ message: 'Facture introuvable' });
  if (!MODIFIABLE_STATUTS.includes(existing.statut)) {
    return res.status(409).json({
      message: "Cette facture a déjà été envoyée : elle ne peut plus être supprimée, pour garder une numérotation fiable. Utilisez plutôt le statut « Annulée ».",
      code: 'INVOICE_NOT_DELETABLE',
    });
  }
  await existing.deleteOne();
  await Payment.deleteMany({ invoice: existing._id });
  res.json({ message: 'Facture supprimée' });
});

// Convertit un devis en facture
// Logique partagée : convertit un devis en facture brouillon. Utilisée à la
// fois par l'action manuelle du propriétaire (ci-dessous) et par
// l'acceptation automatique côté client (voir publicController.respondPublicQuote).
// On ne vérifie PAS la limite du plan Gratuit ici quand l'appel vient du
// client (la limite ne doit jamais bloquer silencieusement l'acceptation
// d'un devis par un client) — c'est à l'appelant de décider s'il vérifie.
async function creerFactureDepuisDevis(quote, ownerId) {
  const invoice = await Invoice.create({
    owner: ownerId,
    client: quote.client,
    quote: quote._id,
    numero: await nextInvoiceNumber(ownerId),
    objet: quote.objet,
    dateEmission: Date.now(),
    items: quote.items.map(i => ({ description: i.description, quantite: i.quantite, prixUnitaire: i.prixUnitaire })),
    remise: quote.remise,
    tva: quote.tva,
    notes: quote.notes,
    statut: 'brouillon',
  });
  await invoice.populate('client');
  return invoice;
}
exports.creerFactureDepuisDevis = creerFactureDepuisDevis;

exports.createFromQuote = asyncHandler(async (req, res) => {
  const limite = await verifierLimiteGratuite(req.userId);
  if (limite) return res.status(403).json(limite);

  const Quote = require('../models/Quote');
  const quote = await Quote.findOne({ _id: req.params.id, owner: req.userId });
  if (!quote) return res.status(404).json({ message: 'Devis introuvable' });

  const invoice = await creerFactureDepuisDevis(quote, req.userId);
  quote.statut = 'accepte';
  quote.invoiceGeneree = invoice._id;
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

// -----------------------------------------------------------------------
// Export comptable (CSV) — avantage Pro/Business (gaté au niveau de la
// route via requireFeature('exportComptable')). Volontairement un CSV
// simple plutôt qu'un format propriétaire.
// GET /api/invoices/export?from=YYYY-MM-DD&to=YYYY-MM-DD&statut=payee
// -----------------------------------------------------------------------
function csvEscape(val) {
  const s = String(val ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

exports.exportComptable = asyncHandler(async (req, res) => {
  const { from, to, statut } = req.query;
  const filter = { owner: req.userId };
  if (statut) filter.statut = statut;
  if (from || to) {
    filter.dateEmission = {};
    if (from) filter.dateEmission.$gte = new Date(from);
    if (to) filter.dateEmission.$lte = new Date(to);
  }

  const invoices = await Invoice.find(filter).populate('client', 'nom entreprise').sort({ dateEmission: 1 });

  const entetes = ['Numero', 'Date emission', 'Date echeance', 'Client', 'Statut', 'Total HT', 'TVA %', 'Total TTC'];
  const lignes = invoices.map((inv) => [
    inv.numero,
    inv.dateEmission ? new Date(inv.dateEmission).toLocaleDateString('fr-FR') : '',
    inv.dateEcheance ? new Date(inv.dateEcheance).toLocaleDateString('fr-FR') : '',
    inv.client?.entreprise || inv.client?.nom || '',
    inv.statut,
    inv.totalHT.toFixed(2),
    inv.tva || 0,
    inv.totalTTC.toFixed(2),
  ]);

  const csv = [entetes, ...lignes].map((ligne) => ligne.map(csvEscape).join(';')).join('\r\n');
  const bom = '\uFEFF';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="factures-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(bom + csv);
});
