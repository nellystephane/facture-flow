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

const ALLOWED = ['client', 'objet', 'dateEmission', 'dateEcheance', 'items', 'remise', 'tva', 'notes', 'template'];

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

// Seule transition de statut déclenchable manuellement : l'annulation.
// Toutes les autres (envoyée, vue, payée, en retard) résultent d'une
// action réelle ailleurs dans le code — jamais d'un choix libre ici.
exports.patchInvoiceStatus = asyncHandler(async (req, res) => {
  const existing = await Invoice.findOne({ _id: req.params.id, owner: req.userId });
  if (!existing) return res.status(404).json({ message: 'Facture introuvable' });
  if (existing.statut === 'payee') {
    return res.status(409).json({ message: 'Une facture déjà payée ne peut pas être annulée.', code: 'INVOICE_NOT_CANCELLABLE' });
  }
  if (existing.statut === 'annulee') {
    return res.status(409).json({ message: 'Cette facture est déjà annulée.', code: 'INVOICE_NOT_CANCELLABLE' });
  }
  existing.statut = 'annulee';
  await existing.save();
  await existing.populate('client');
  enregistrerActivite(req, { action: 'facture.annulee', ressource: 'facture', ressourceId: existing._id, details: `Facture ${existing.numero} annulée` });
  res.json(existing);
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
// -----------------------------------------------------------------------
// Export comptable (Excel) — avantage Pro/Business (gaté au niveau de la
// route via requireFeature('exportComptable')). Un vrai .xlsx avec mise en
// forme (exceljs), pas un CSV brut : cohérent avec le fait que ce soit un
// avantage payant — le style doit être à la hauteur.
// GET /api/invoices/export?from=YYYY-MM-DD&to=YYYY-MM-DD&statut=payee
// -----------------------------------------------------------------------
const ROUGE_FACTUFLOW = 'FFD9524D';
const NOIR_FACTUFLOW = 'FF0A0A0C';
const GRIS_CLAIR = 'FFF7F7F8';

function styleEntete(ligne) {
  ligne.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROUGE_FACTUFLOW } };
    cell.alignment = { vertical: 'middle' };
  });
  ligne.height = 22;
}

function styleTitre(ligne, taille = 15) {
  ligne.eachCell((cell) => {
    cell.font = { bold: true, size: taille, color: { argb: NOIR_FACTUFLOW } };
  });
}

const FORMAT_MONTANT = '#,##0 "FCFA"';

exports.exportComptable = asyncHandler(async (req, res) => {
  const ExcelJS = require('exceljs');
  const { from, to, statut } = req.query;
  const filter = { owner: req.userId };
  if (statut) filter.statut = statut;
  if (from || to) {
    filter.dateEmission = {};
    if (from) filter.dateEmission.$gte = new Date(from);
    if (to) filter.dateEmission.$lte = new Date(to);
  }

  const [user, invoices] = await Promise.all([
    User.findById(req.userId),
    Invoice.find(filter).populate('client', 'nom entreprise').sort({ dateEmission: 1 }),
  ]);

  const invoiceIds = invoices.map((i) => i._id);
  const paiements = await Payment.find({ owner: req.userId, invoice: { $in: invoiceIds }, statut: 'complete' })
    .populate({ path: 'invoice', select: 'numero client', populate: { path: 'client', select: 'nom entreprise' } })
    .sort({ date: 1 });

  const periode = from || to
    ? `Période : ${from ? new Date(from).toLocaleDateString('fr-FR') : '…'} → ${to ? new Date(to).toLocaleDateString('fr-FR') : '…'}`
    : 'Toutes les factures';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FactuFlow';
  workbook.created = new Date();

  // ===== Onglet 1 : Factures =====
  const wsFactures = workbook.addWorksheet('Factures', { views: [{ state: 'frozen', ySplit: 5 }] });
  wsFactures.mergeCells('A1:H1');
  wsFactures.getCell('A1').value = `${user.entreprise || user.nom} — Export des factures`;
  styleTitre(wsFactures.getRow(1));
  wsFactures.mergeCells('A2:H2');
  wsFactures.getCell('A2').value = `${periode} — généré le ${new Date().toLocaleDateString('fr-FR')}`;
  wsFactures.getCell('A2').font = { italic: true, size: 9.5, color: { argb: 'FF6B7280' } };

  const enteteFactures = wsFactures.getRow(4);
  enteteFactures.values = ['Numéro', 'Date émission', 'Échéance', 'Client', 'Statut', 'Total HT', 'TVA %', 'Total TTC'];
  styleEntete(enteteFactures);

  const STATUT_LABEL = { brouillon: 'En attente d\'envoi', envoyee: 'Envoyée', vue: 'Vue', payee: 'Payée', en_retard: 'En retard', annulee: 'Annulée' };

  let ligneIdx = 5;
  let totalHT = 0, totalTTC = 0;
  invoices.forEach((inv, i) => {
    const row = wsFactures.getRow(ligneIdx);
    row.values = [
      inv.numero,
      inv.dateEmission ? new Date(inv.dateEmission) : '',
      inv.dateEcheance ? new Date(inv.dateEcheance) : '',
      inv.client?.entreprise || inv.client?.nom || '',
      STATUT_LABEL[inv.statut] || inv.statut,
      inv.totalHT,
      (inv.tva || 0) / 100,
      inv.totalTTC,
    ];
    row.getCell(2).numFmt = 'dd/mm/yyyy';
    row.getCell(3).numFmt = 'dd/mm/yyyy';
    row.getCell(6).numFmt = FORMAT_MONTANT;
    row.getCell(7).numFmt = '0%';
    row.getCell(8).numFmt = FORMAT_MONTANT;
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(8).alignment = { horizontal: 'right' };
    if (i % 2 === 0) {
      row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLAIR } }; });
    }
    totalHT += inv.totalHT;
    totalTTC += inv.totalTTC;
    ligneIdx += 1;
  });

  const totalRow = wsFactures.getRow(ligneIdx + 1);
  totalRow.values = ['', '', '', '', `${invoices.length} facture(s)`, totalHT, '', totalTTC];
  totalRow.eachCell((cell) => { cell.font = { bold: true }; cell.border = { top: { style: 'medium', color: { argb: NOIR_FACTUFLOW } } }; });
  totalRow.getCell(6).numFmt = FORMAT_MONTANT;
  totalRow.getCell(8).numFmt = FORMAT_MONTANT;
  totalRow.getCell(6).alignment = { horizontal: 'right' };
  totalRow.getCell(8).alignment = { horizontal: 'right' };

  wsFactures.columns = [
    { width: 16 }, { width: 14 }, { width: 14 }, { width: 26 }, { width: 14 }, { width: 15 }, { width: 8 }, { width: 15 },
  ];

  // ===== Onglet 2 : Paiements =====
  const wsPaiements = workbook.addWorksheet('Paiements', { views: [{ state: 'frozen', ySplit: 5 }] });
  wsPaiements.mergeCells('A1:F1');
  wsPaiements.getCell('A1').value = `${user.entreprise || user.nom} — Paiements reçus`;
  styleTitre(wsPaiements.getRow(1));
  wsPaiements.mergeCells('A2:F2');
  wsPaiements.getCell('A2').value = `${periode} — généré le ${new Date().toLocaleDateString('fr-FR')}`;
  wsPaiements.getCell('A2').font = { italic: true, size: 9.5, color: { argb: 'FF6B7280' } };

  const METHODE_LABEL = { especes: 'Espèces', mtn_money: 'MTN Money', moov_money: 'Moov Money', carte: 'Carte', virement: 'Virement', autre: 'Autre' };
  const enteentePaiements = wsPaiements.getRow(4);
  enteentePaiements.values = ['Date', 'Facture', 'Client', 'Montant', 'Méthode', 'Référence'];
  styleEntete(enteentePaiements);

  let ligneP = 5;
  let totalPaye = 0;
  paiements.forEach((p, i) => {
    const row = wsPaiements.getRow(ligneP);
    row.values = [
      p.date ? new Date(p.date) : '',
      p.invoice?.numero || '',
      p.invoice?.client?.entreprise || p.invoice?.client?.nom || '',
      p.montant,
      METHODE_LABEL[p.methode] || p.methode,
      p.reference || '—',
    ];
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(4).numFmt = FORMAT_MONTANT;
    row.getCell(4).alignment = { horizontal: 'right' };
    if (i % 2 === 0) {
      row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLAIR } }; });
    }
    totalPaye += p.montant || 0;
    ligneP += 1;
  });

  const totalRowP = wsPaiements.getRow(ligneP + 1);
  totalRowP.values = ['', '', `${paiements.length} paiement(s)`, totalPaye, '', ''];
  totalRowP.eachCell((cell) => { cell.font = { bold: true }; cell.border = { top: { style: 'medium', color: { argb: NOIR_FACTUFLOW } } }; });
  totalRowP.getCell(4).numFmt = FORMAT_MONTANT;
  totalRowP.getCell(4).alignment = { horizontal: 'right' };

  wsPaiements.columns = [{ width: 14 }, { width: 16 }, { width: 26 }, { width: 15 }, { width: 14 }, { width: 20 }];

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="factuflow-export-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});
