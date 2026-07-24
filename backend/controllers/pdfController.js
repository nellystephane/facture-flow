const PDFDocument = require('pdfkit');
const Invoice = require('../models/Invoice');
const Quote = require('../models/Quote');
const User = require('../models/User');
const Payment = require('../models/Payment');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

const ROUGE = '#dc2626';
const NOIR = '#0a0a0a';
const GRIS = '#6b7280';

function formatMontant(n) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function calcTTC(doc) {
  const ht = (doc.items || []).reduce((s, i) => s + (i.quantite || 0) * (i.prixUnitaire || 0), 0) - (doc.remise || 0);
  return { ht, ttc: ht * (1 + (doc.tva || 0) / 100) };
}

// Construit un PDF commun pour facture ou devis
function buildPdf(doc, options, res) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    const filename = encodeURIComponent((options.titre + '-' + (doc.numero || '')).replace(/\s+/g, '_'));
    res.setHeader('Content-Disposition', `inline; filename="${filename}.pdf"`);

    pdf.pipe(res);
    res.on('finish', resolve);
    pdf.on('error', reject);

    const pageWidth = 595;

    // ---- En-tête : barre rouge ----
    pdf.rect(0, 0, pageWidth, 8).fill(ROUGE);

    // ---- Logo + titre ----
    pdf.fillColor(ROUGE).fontSize(26).font('Helvetica-Bold').text('FactuFlow', 50, 40);
    pdf.fillColor(NOIR).fontSize(22).font('Helvetica-Bold').text(options.titre, 50, 75);
    pdf.fillColor(GRIS).fontSize(10).font('Helvetica').text(options.sousTitre, 50, 100);

    // Numéro + dates (droite)
    pdf.fontSize(10).fillColor(NOIR);
    pdf.font('Helvetica-Bold').text('N° ' + (doc.numero || ''), 380, 40, { width: 165, align: 'right' });
    pdf.font('Helvetica').fillColor(GRIS);
    pdf.text("Date d'émission: " + formatDate(doc.dateEmission), 380, 58, { width: 165, align: 'right' });
    if (options.echeanceLabel && doc[options.echeanceField]) {
      pdf.text(options.echeanceLabel + formatDate(doc[options.echeanceField]), 380, 74, { width: 165, align: 'right' });
    }
    pdf.text('Statut: ' + options.statutLabel, 380, 90, { width: 165, align: 'right' });

    // ---- Émetteur / Client ----
    pdf.fillColor(ROUGE).font('Helvetica-Bold').fontSize(9).text('ÉMETTEUR', 50, 145);
    pdf.fillColor(NOIR).font('Helvetica-Bold').fontSize(11).text(options.emetteurNom, 50, 160);
    pdf.font('Helvetica').fillColor(GRIS).fontSize(9);
    if (options.emetteurEntreprise) pdf.text(options.emetteurEntreprise, 50, 175);
    if (options.emetteurEmail) pdf.text(options.emetteurEmail, 50, 188);
    if (options.emetteurTelephone) pdf.text(options.emetteurTelephone, 50, 201);
    if (options.emetteurAdresse) pdf.text(options.emetteurAdresse, 50, 214);

    pdf.fillColor(ROUGE).font('Helvetica-Bold').fontSize(9).text('CLIENT', 320, 145);
    pdf.fillColor(NOIR).font('Helvetica-Bold').fontSize(11).text(doc.client?.nom || '', 320, 160);
    pdf.font('Helvetica').fillColor(GRIS).fontSize(9);
    if (doc.client?.entreprise) pdf.text(doc.client.entreprise, 320, 175);
    if (doc.client?.email) pdf.text(doc.client.email, 320, 188);
    if (doc.client?.telephone) pdf.text(doc.client.telephone, 320, 201);
    if (doc.client?.adresse) pdf.text(doc.client.adresse, 320, 214);

    // ---- Tableau des articles ----
    const tableTop = 270;
    pdf.rect(50, tableTop, pageWidth - 100, 24).fill(ROUGE);
    pdf.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
    pdf.text('Description', 60, tableTop + 7, { width: 240 });
    pdf.text('Qté', 310, tableTop + 7, { width: 50, align: 'center' });
    pdf.text('Prix unit.', 370, tableTop + 7, { width: 80, align: 'right' });
    pdf.text('Total', 470, tableTop + 7, { width: 75, align: 'right' });

    let y = tableTop + 24;
    pdf.font('Helvetica').fontSize(10).fillColor(NOIR);
    (doc.items || []).forEach((item, idx) => {
      if (idx % 2 === 0) pdf.rect(50, y, pageWidth - 100, 24).fill('#fafafa');
      pdf.fillColor(NOIR);
      pdf.text(item.description || '', 60, y + 7, { width: 240 });
      pdf.text(String(item.quantite || 0), 310, y + 7, { width: 50, align: 'center' });
      pdf.text(formatMontant(item.prixUnitaire || 0), 370, y + 7, { width: 80, align: 'right' });
      pdf.text(formatMontant((item.quantite || 0) * (item.prixUnitaire || 0)), 470, y + 7, { width: 75, align: 'right' });
      y += 24;
    });

    // ---- Totaux ----
    const { ht, ttc } = calcTTC(doc);
    const remise = doc.remise || 0;
    const montantTva = ht * (doc.tva || 0) / 100;
    y += 10;

    pdf.fillColor(GRIS).font('Helvetica').fontSize(10);
    pdf.text('Sous-total', 350, y, { width: 120, align: 'right' });
    pdf.fillColor(NOIR).font('Helvetica-Bold').text(formatMontant(ht + remise), 470, y, { width: 75, align: 'right' });
    y += 18;
    if (remise > 0) {
      pdf.fillColor(GRIS).font('Helvetica').text('Remise', 350, y, { width: 120, align: 'right' });
      pdf.fillColor(ROUGE).font('Helvetica-Bold').text('- ' + formatMontant(remise), 470, y, { width: 75, align: 'right' });
      y += 18;
    }
    pdf.fillColor(GRIS).font('Helvetica').text('TVA (' + (doc.tva || 0) + '%)', 350, y, { width: 120, align: 'right' });
    pdf.fillColor(NOIR).font('Helvetica-Bold').text(formatMontant(montantTva), 470, y, { width: 75, align: 'right' });
    y += 24;

    pdf.rect(350, y, 195, 30).fill(NOIR);
    pdf.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12);
    pdf.text('TOTAL TTC', 360, y + 9);
    pdf.text(formatMontant(ttc), 470, y + 9, { width: 70, align: 'right' });

    // ---- Notes ----
    if (doc.notes) {
      pdf.fillColor(ROUGE).font('Helvetica-Bold').fontSize(9).text('NOTES', 50, y + 60);
      pdf.fillColor(GRIS).font('Helvetica').fontSize(9).text(doc.notes, 50, y + 75, { width: 300 });
    }

    // ---- Pied de page ----
    pdf.rect(0, pdf.page.height - 50, pageWidth, 50).fill(NOIR);
    pdf.fillColor('#ffffff').fontSize(8).font('Helvetica');
    pdf.text(options.piedGauche || 'Merci pour votre confiance.', 50, pdf.page.height - 32, { width: 250 });
    pdf.text('Généré avec FactuFlow', 295, pdf.page.height - 32, { width: 250, align: 'right' });

    pdf.end();
  });
}

const STATUT_INVOICE = {
  brouillon: 'Brouillon', envoyee: 'Envoyée', vue: 'Vue',
  payee: 'Payée', en_retard: 'En retard', annulee: 'Annulée'
};
const STATUT_QUOTE = {
  brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé', expire: 'Expiré'
};

exports.invoicePdf = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, owner: req.userId }).populate('client');
  if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
  const user = await User.findById(req.userId);
  await buildPdf(invoice, {
    titre: 'FACTURE',
    sousTitre: invoice.objet || '',
    echeanceLabel: "Échéance: ",
    echeanceField: 'dateEcheance',
    statutLabel: STATUT_INVOICE[invoice.statut] || invoice.statut,
    emetteurNom: user.nom,
    emetteurEntreprise: user.entreprise,
    emetteurEmail: user.email,
    emetteurTelephone: user.telephone,
    emetteurAdresse: user.adresse,
    piedGauche: 'Merci pour votre confiance.'
  }, res);
});

exports.quotePdf = asyncHandler(async (req, res) => {
  const quote = await Quote.findOne({ _id: req.params.id, owner: req.userId }).populate('client');
  if (!quote) return res.status(404).json({ message: 'Devis introuvable' });
  const user = await User.findById(req.userId);
  await buildPdf(quote, {
    titre: 'DEVIS',
    sousTitre: quote.objet || '',
    echeanceLabel: "Valable jusqu'au: ",
    echeanceField: 'dateExpiration',
    statutLabel: STATUT_QUOTE[quote.statut] || quote.statut,
    emetteurNom: user.nom,
    emetteurEntreprise: user.entreprise,
    emetteurEmail: user.email,
    emetteurTelephone: user.telephone,
    emetteurAdresse: user.adresse,
    piedGauche: 'Devis valable 30 jours.'
  }, res);
});

// Utilisé pour récupérer le total payé (utilisé côté front pour affichage)
exports.invoiceStatus = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ invoice: req.params.id });
  const totalPaye = payments.reduce((s, p) => s + (p.montant || 0), 0);
  res.json({ totalPaye, paiements: payments });
});
