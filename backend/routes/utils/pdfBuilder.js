const PDFDocument = require('pdfkit');

const ACCENT = '#c9504b';
const ACCENT_DARK = '#8f3530';
const NOIR = '#0f0f13';
const GRIS = '#6b7280';
const GRIS_CLAIR = '#9ca3af';
const LIGNE = '#e5e7eb';
const VERT = '#16803c';

function formatMontant(n, devise = 'FCFA') {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' ' + devise;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function calcTotals(doc) {
  const sousTotal = (doc.items || []).reduce((s, i) => s + (i.quantite || 0) * (i.prixUnitaire || 0), 0);
  const ht = sousTotal - (doc.remise || 0);
  const montantTva = ht * (doc.tva || 0) / 100;
  return { sousTotal, ht, montantTva, ttc: ht + montantTva };
}

/** Exécute un PDFDocument et retourne un Buffer (utile pour pièces jointes email). */
function toBuffer(drawFn) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    pdf.on('data', (c) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    try {
      drawFn(pdf);
      pdf.end();
    } catch (err) {
      reject(err);
    }
  });
}

function drawHeader(pdf, { user, docTitre, docNumero, docSousTitre, statutLabel, statutColor, dateEmission, echeanceLabel, echeanceDate }) {
  const pageWidth = 595;
  pdf.rect(0, 0, pageWidth, 6).fill(ACCENT);

  // Nom de l'entreprise émettrice en en-tête (pas la marque de l'appli)
  const emetteur = user.entreprise || user.nom;
  pdf.fillColor(NOIR).fontSize(20).font('Helvetica-Bold').text(emetteur, 50, 36, { width: 320 });
  if (user.entreprise && user.nom) {
    pdf.fillColor(GRIS).fontSize(9).font('Helvetica').text(user.nom, 50, 58);
  }

  pdf.fillColor(ACCENT).fontSize(16).font('Helvetica-Bold').text(docTitre, 380, 36, { width: 165, align: 'right' });
  pdf.fillColor(NOIR).fontSize(11).font('Helvetica-Bold').text('N° ' + (docNumero || ''), 380, 58, { width: 165, align: 'right' });

  let y = 78;
  pdf.fillColor(GRIS).fontSize(9).font('Helvetica');
  pdf.text("Date d'émission : " + formatDate(dateEmission), 380, y, { width: 165, align: 'right' });
  y += 14;
  if (echeanceLabel && echeanceDate) {
    pdf.text(echeanceLabel + formatDate(echeanceDate), 380, y, { width: 165, align: 'right' });
    y += 14;
  }
  if (statutLabel) {
    pdf.fillColor(statutColor || GRIS).font('Helvetica-Bold').text(statutLabel.toUpperCase(), 380, y, { width: 165, align: 'right' });
  }

  // Coordonnées émetteur (sous le nom)
  pdf.fillColor(GRIS).fontSize(8.5).font('Helvetica');
  let ey = user.entreprise && user.nom ? 72 : 60;
  if (user.adresse) { pdf.text(user.adresse, 50, ey, { width: 300 }); ey += 12; }
  const contact = [user.email, user.telephone].filter(Boolean).join('  •  ');
  if (contact) { pdf.text(contact, 50, ey, { width: 300 }); ey += 12; }

  return Math.max(ey + 10, 118);
}

function drawClientBlock(pdf, client, y) {
  pdf.fillColor(ACCENT).font('Helvetica-Bold').fontSize(8.5).text('FACTURÉ À', 50, y);
  pdf.fillColor(NOIR).font('Helvetica-Bold').fontSize(11).text(client?.nom || 'Client', 50, y + 14);
  pdf.fillColor(GRIS).font('Helvetica').fontSize(9);
  let cy = y + 30;
  if (client?.entreprise) { pdf.text(client.entreprise, 50, cy); cy += 13; }
  if (client?.email) { pdf.text(client.email, 50, cy); cy += 13; }
  if (client?.telephone) { pdf.text(client.telephone, 50, cy); cy += 13; }
  if (client?.adresse) { pdf.text(client.adresse, 50, cy); cy += 13; }
  return cy + 8;
}

function drawItemsTable(pdf, items, devise, startY) {
  const pageWidth = 595;
  let y = startY;
  pdf.rect(50, y, pageWidth - 100, 24).fill(NOIR);
  pdf.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9.5);
  pdf.text('DESCRIPTION', 60, y + 8, { width: 235 });
  pdf.text('QTÉ', 300, y + 8, { width: 50, align: 'center' });
  pdf.text('PRIX UNIT.', 360, y + 8, { width: 90, align: 'right' });
  pdf.text('TOTAL', 460, y + 8, { width: 85, align: 'right' });
  y += 24;

  pdf.font('Helvetica').fontSize(9.5);
  (items || []).forEach((item, idx) => {
    const rowHeight = 24;
    if (idx % 2 === 0) pdf.rect(50, y, pageWidth - 100, rowHeight).fill('#f8f8fa');
    pdf.fillColor(NOIR);
    pdf.text(item.description || '', 60, y + 7, { width: 235 });
    pdf.text(String(item.quantite || 0), 300, y + 7, { width: 50, align: 'center' });
    pdf.text(formatMontant(item.prixUnitaire || 0, devise), 360, y + 7, { width: 90, align: 'right' });
    pdf.font('Helvetica-Bold').text(formatMontant((item.quantite || 0) * (item.prixUnitaire || 0), devise), 460, y + 7, { width: 85, align: 'right' });
    pdf.font('Helvetica');
    y += rowHeight;
  });
  pdf.moveTo(50, y).lineTo(pageWidth - 50, y).strokeColor(LIGNE).stroke();
  return y + 10;
}

function drawTotals(pdf, doc, devise, startY) {
  const { sousTotal, montantTva, ttc } = calcTotals(doc);
  let y = startY;
  pdf.fillColor(GRIS).font('Helvetica').fontSize(10);
  pdf.text('Sous-total', 350, y, { width: 120, align: 'right' });
  pdf.fillColor(NOIR).font('Helvetica-Bold').text(formatMontant(sousTotal, devise), 460, y, { width: 85, align: 'right' });
  y += 18;
  if (doc.remise > 0) {
    pdf.fillColor(GRIS).font('Helvetica').text('Remise', 350, y, { width: 120, align: 'right' });
    pdf.fillColor(ACCENT).font('Helvetica-Bold').text('- ' + formatMontant(doc.remise, devise), 460, y, { width: 85, align: 'right' });
    y += 18;
  }
  pdf.fillColor(GRIS).font('Helvetica').text('TVA (' + (doc.tva || 0) + '%)', 350, y, { width: 120, align: 'right' });
  pdf.fillColor(NOIR).font('Helvetica-Bold').text(formatMontant(montantTva, devise), 460, y, { width: 85, align: 'right' });
  y += 26;

  pdf.rect(350, y, 195, 32).fill(NOIR);
  pdf.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12.5);
  pdf.text('TOTAL TTC', 362, y + 10);
  pdf.text(formatMontant(ttc, devise), 355, y + 10, { width: 180, align: 'right' });
  return { y: y + 32, ttc };
}

function drawFooter(pdf, gauche) {
  const pageWidth = 595;
  pdf.rect(0, pdf.page.height - 40, pageWidth, 40).fill(NOIR);
  pdf.fillColor('#ffffff').fontSize(8).font('Helvetica');
  pdf.text(gauche || '', 50, pdf.page.height - 25, { width: 350 });
  pdf.fillColor('#9ca3af').text('Document généré via FactuFlow', 300, pdf.page.height - 25, { width: 245, align: 'right' });
}

/** Bouton de paiement cliquable + coordonnées bancaires pour virement. */
function drawPaymentSection(pdf, { y, paymentUrl, banque, devise, montant }) {
  const pageWidth = 595;
  let cy = y + 20;

  if (paymentUrl) {
    const btnW = 220, btnH = 36, btnX = 50, btnY = cy;
    pdf.roundedRect(btnX, btnY, btnW, btnH, 6).fill(ACCENT);
    pdf.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
      .text('PAYER EN LIGNE MAINTENANT', btnX, btnY + 12, { width: btnW, align: 'center' });
    pdf.link(btnX, btnY, btnW, btnH, paymentUrl);
    pdf.fillColor(GRIS_CLAIR).font('Helvetica').fontSize(7.5)
      .text(paymentUrl, btnX, btnY + btnH + 6, { width: 400 });
    cy += btnH + 26;
  }

  if (banque && (banque.iban || banque.rib || banque.nomBanque)) {
    pdf.fillColor(ACCENT).font('Helvetica-Bold').fontSize(8.5).text('PAIEMENT PAR VIREMENT BANCAIRE', 50, cy);
    cy += 14;
    pdf.fillColor(GRIS).font('Helvetica').fontSize(9);
    if (banque.nomBanque) { pdf.text('Banque : ' + banque.nomBanque, 50, cy); cy += 13; }
    if (banque.titulaire) { pdf.text('Titulaire : ' + banque.titulaire, 50, cy); cy += 13; }
    if (banque.iban) { pdf.text('IBAN : ' + banque.iban, 50, cy); cy += 13; }
    if (banque.rib) { pdf.text('RIB : ' + banque.rib, 50, cy); cy += 13; }
    if (banque.swift) { pdf.text('SWIFT/BIC : ' + banque.swift, 50, cy); cy += 13; }
    cy += 6;
  }

  return cy;
}

const STATUT_INVOICE_LABEL = {
  brouillon: 'Brouillon', envoyee: 'Envoyée', vue: 'Vue',
  payee: 'Payée', en_retard: 'En retard', annulee: 'Annulée'
};
const STATUT_INVOICE_COLOR = {
  brouillon: GRIS, envoyee: '#1d4ed8', vue: '#7c3aed',
  payee: VERT, en_retard: ACCENT, annulee: GRIS
};
const STATUT_QUOTE_LABEL = {
  brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé', expire: 'Expiré'
};

function drawInvoiceOrQuote(pdf, { doc, user, isQuote, paymentUrl }) {
  const devise = user.devise || 'FCFA';
  const statutLabel = isQuote ? STATUT_QUOTE_LABEL[doc.statut] : STATUT_INVOICE_LABEL[doc.statut];
  const statutColor = isQuote ? '#1d4ed8' : STATUT_INVOICE_COLOR[doc.statut];

  let y = drawHeader(pdf, {
    user,
    docTitre: isQuote ? 'DEVIS' : 'FACTURE',
    docNumero: doc.numero,
    statutLabel,
    statutColor,
    dateEmission: doc.dateEmission,
    echeanceLabel: isQuote ? "Valable jusqu'au : " : 'Échéance : ',
    echeanceDate: isQuote ? doc.dateExpiration : doc.dateEcheance,
  });

  if (doc.objet) {
    pdf.fillColor(GRIS).font('Helvetica-Oblique').fontSize(9.5).text(doc.objet, 50, y, { width: 495 });
    y += 18;
  }

  y = drawClientBlock(pdf, doc.client, y + 6);
  y = drawItemsTable(pdf, doc.items, devise, y + 4);
  const { y: afterTotals } = drawTotals(pdf, doc, devise, y + 6);
  y = afterTotals;

  if (!isQuote && doc.statut !== 'payee' && doc.statut !== 'annulee') {
    y = drawPaymentSection(pdf, { y, paymentUrl, banque: user.banque, devise, montant: calcTotals(doc).ttc });
  }

  if (doc.notes) {
    pdf.fillColor(ACCENT).font('Helvetica-Bold').fontSize(8.5).text('NOTES', 50, y + 8);
    pdf.fillColor(GRIS).font('Helvetica').fontSize(9).text(doc.notes, 50, y + 22, { width: 495 });
  }

  drawFooter(pdf, isQuote ? 'Devis valable jusqu\'à la date indiquée ci-dessus.' : 'Merci pour votre confiance.');
}

async function buildInvoicePdf({ invoice, user, paymentUrl }) {
  return toBuffer((pdf) => drawInvoiceOrQuote(pdf, { doc: invoice, user, isQuote: false, paymentUrl }));
}

async function buildQuotePdf({ quote, user }) {
  return toBuffer((pdf) => drawInvoiceOrQuote(pdf, { doc: quote, user, isQuote: true }));
}

/** Reçu de paiement — document distinct, remis après règlement. */
async function buildReceiptPdf({ invoice, payment, user }) {
  const devise = user.devise || 'FCFA';
  const METHODE_LABEL = {
    especes: 'Espèces', mtn_money: 'MTN Mobile Money', moov_money: 'Moov Money',
    carte: 'Carte bancaire', virement: 'Virement bancaire', autre: 'Autre'
  };

  return toBuffer((pdf) => {
    let y = drawHeader(pdf, {
      user,
      docTitre: 'REÇU',
      docNumero: payment.receiptNumber || String(payment._id).slice(-8).toUpperCase(),
      statutLabel: 'Payé',
      statutColor: VERT,
      dateEmission: payment.date,
    });

    y = drawClientBlock(pdf, invoice.client, y + 6);

    y += 10;
    pdf.rect(50, y, 495, 90).fillAndStroke('#f8f8fa', LIGNE);
    pdf.fillColor(GRIS).font('Helvetica').fontSize(9.5).text('Facture réglée', 70, y + 16);
    pdf.fillColor(NOIR).font('Helvetica-Bold').fontSize(12).text(invoice.numero, 70, y + 30);

    pdf.fillColor(GRIS).font('Helvetica').fontSize(9.5).text('Moyen de paiement', 300, y + 16);
    pdf.fillColor(NOIR).font('Helvetica-Bold').fontSize(12).text(METHODE_LABEL[payment.methode] || payment.methode, 300, y + 30);

    pdf.fillColor(GRIS).font('Helvetica').fontSize(9.5).text('Référence', 70, y + 55);
    pdf.fillColor(NOIR).font('Helvetica-Bold').fontSize(10.5).text(payment.reference || payment.fedapayTransactionId || '—', 70, y + 69);

    pdf.fillColor(VERT).font('Helvetica-Bold').fontSize(20).text('PAYÉ', 380, y + 55, { width: 145, align: 'right' });

    y += 110;
    pdf.fillColor(GRIS).font('Helvetica').fontSize(11).text('Montant réglé', 50, y);
    pdf.fillColor(VERT).font('Helvetica-Bold').fontSize(22).text(formatMontant(payment.montant, devise), 50, y + 16);

    y += 60;
    if (payment.note) {
      pdf.fillColor(ACCENT).font('Helvetica-Bold').fontSize(8.5).text('NOTE', 50, y);
      pdf.fillColor(GRIS).font('Helvetica').fontSize(9).text(payment.note, 50, y + 14, { width: 495 });
    }

    drawFooter(pdf, 'Ce reçu confirme la réception du paiement indiqué ci-dessus.');
  });
}

module.exports = {
  toBuffer,
  buildInvoicePdf,
  buildQuotePdf,
  buildReceiptPdf,
  formatMontant,
  calcTotals,
};
