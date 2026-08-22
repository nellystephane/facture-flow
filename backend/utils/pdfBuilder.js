const PDFDocument = require('pdfkit');

const ACCENT = '#c9504b';
const ACCENT_DARK = '#8f3530';
const NOIR = '#0f0f13';
const GRIS = '#6b7280';
const GRIS_CLAIR = '#9ca3af';
const LIGNE = '#e5e7eb';
const VERT = '#16803c';

// Modèles de facture/devis (avantage Pro/Business — voir config/plans.js).
// Un style est un simple jeu de couleurs/options passé en paramètre à chaque
// fonction de dessin — jamais un état de module partagé, pour rester
// thread-safe si plusieurs PDF se génèrent en parallèle (Promise.all).
const TEMPLATE_STYLES = {
  classique: { accent: ACCENT, bandeArticles: NOIR, totalBox: NOIR, bandeEnTete: true },
  moderne: { accent: '#1d4ed8', bandeArticles: '#1d4ed8', totalBox: '#1d4ed8', bandeEnTete: true },
  minimal: { accent: '#111111', bandeArticles: '#111111', totalBox: '#111111', bandeEnTete: false },
};
function styleDe(templateId) {
  return TEMPLATE_STYLES[templateId] || TEMPLATE_STYLES.classique;
}

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

// Le logo personnalisé est un avantage des plans Pro/Business (voir README).
// user.logoUrl contient soit une image envoyée directement par l'utilisateur
// (data:image/...;base64,... — le cas normal depuis "Mon profil") soit,
// pour compatibilité avec d'anciens comptes, une URL https:// externe.
const LOGO_TAILLE_MAX = 2 * 1024 * 1024; // 2 Mo
async function fetchLogoBuffer(user) {
  if (!user?.estPremium || !user?.logoUrl) return null;

  const dataUriMatch = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/i.exec(user.logoUrl);
  if (dataUriMatch) {
    try {
      const buffer = Buffer.from(dataUriMatch[2], 'base64');
      return buffer.length > 0 && buffer.length <= LOGO_TAILLE_MAX ? buffer : null;
    } catch (err) {
      console.error('Logo PDF (base64) illisible:', err.message);
      return null;
    }
  }

  if (!/^https:\/\//i.test(user.logoUrl)) return null; // on n'accepte que du https pour une URL externe
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(user.logoUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || '';
    if (!/^image\/(png|jpe?g)/i.test(contentType)) return null;
    const arrayBuffer = await resp.arrayBuffer();
    if (arrayBuffer.byteLength > LOGO_TAILLE_MAX) return null;
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('Logo PDF non chargé (' + user.logoUrl + '):', err.message);
    return null;
  }
}

function drawHeader(pdf, { user, docTitre, docNumero, docSousTitre, statutLabel, statutColor, dateEmission, echeanceLabel, echeanceDate, logoBuffer, style }) {
  const pageWidth = 595;
  if (style.bandeEnTete) pdf.rect(0, 0, pageWidth, 6).fill(style.accent);

  // Si un logo Pro/Business est disponible, on le place à gauche et on
  // décale le nom de l'entreprise pour laisser la place.
  const texteX = logoBuffer ? 106 : 50;
  if (logoBuffer) {
    try {
      pdf.image(logoBuffer, 50, 30, { fit: [46, 46] });
    } catch (err) {
      console.error('Logo PDF illisible:', err.message);
    }
  }

  // Nom de l'entreprise émettrice en en-tête (pas la marque de l'appli)
  const emetteur = user.entreprise || user.nom;
  pdf.fillColor(NOIR).fontSize(20).font('Helvetica-Bold').text(emetteur, texteX, 36, { width: 320 - (texteX - 50) });
  if (user.entreprise && user.nom) {
    pdf.fillColor(GRIS).fontSize(9).font('Helvetica').text(user.nom, texteX, 58);
  }

  pdf.fillColor(style.accent).fontSize(16).font('Helvetica-Bold').text(docTitre, 380, 36, { width: 165, align: 'right' });
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
  if (user.adresse) { pdf.text(user.adresse, texteX, ey, { width: 300 - (texteX - 50) }); ey += 12; }
  const contact = [user.email, user.telephone].filter(Boolean).join('  •  ');
  if (contact) { pdf.text(contact, texteX, ey, { width: 300 - (texteX - 50) }); ey += 12; }
  if (logoBuffer) ey = Math.max(ey, 86);

  return Math.max(ey + 10, 118);
}

function drawClientBlock(pdf, client, y, style) {
  pdf.fillColor(style.accent).font('Helvetica-Bold').fontSize(8.5).text('FACTURÉ À', 50, y);
  pdf.fillColor(NOIR).font('Helvetica-Bold').fontSize(11).text(client?.nom || 'Client', 50, y + 14);
  pdf.fillColor(GRIS).font('Helvetica').fontSize(9);
  let cy = y + 30;
  if (client?.entreprise) { pdf.text(client.entreprise, 50, cy); cy += 13; }
  if (client?.email) { pdf.text(client.email, 50, cy); cy += 13; }
  if (client?.telephone) { pdf.text(client.telephone, 50, cy); cy += 13; }
  if (client?.adresse) { pdf.text(client.adresse, 50, cy); cy += 13; }
  return cy + 8;
}

function drawItemsTable(pdf, items, devise, startY, style) {
  const pageWidth = 595;
  let y = startY;
  pdf.rect(50, y, pageWidth - 100, 24).fill(style.bandeArticles);
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

function drawTotals(pdf, doc, devise, startY, style) {
  const { sousTotal, montantTva, ttc } = calcTotals(doc);
  let y = startY;
  pdf.fillColor(GRIS).font('Helvetica').fontSize(10);
  pdf.text('Sous-total', 350, y, { width: 120, align: 'right' });
  pdf.fillColor(NOIR).font('Helvetica-Bold').text(formatMontant(sousTotal, devise), 460, y, { width: 85, align: 'right' });
  y += 18;
  if (doc.remise > 0) {
    pdf.fillColor(GRIS).font('Helvetica').text('Remise', 350, y, { width: 120, align: 'right' });
    pdf.fillColor(style.accent).font('Helvetica-Bold').text('- ' + formatMontant(doc.remise, devise), 460, y, { width: 85, align: 'right' });
    y += 18;
  }
  pdf.fillColor(GRIS).font('Helvetica').text('TVA (' + (doc.tva || 0) + '%)', 350, y, { width: 120, align: 'right' });
  pdf.fillColor(NOIR).font('Helvetica-Bold').text(formatMontant(montantTva, devise), 460, y, { width: 85, align: 'right' });
  y += 26;

  pdf.rect(350, y, 195, 32).fill(style.totalBox);
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
function drawPaymentSection(pdf, { y, paymentUrl, banque, devise, montant, style }) {
  const pageWidth = 595;
  let cy = y + 20;

  if (paymentUrl) {
    const btnW = 220, btnH = 36, btnX = 50, btnY = cy;
    pdf.roundedRect(btnX, btnY, btnW, btnH, 6).fill(style.accent);
    pdf.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
      .text('PAYER EN LIGNE MAINTENANT', btnX, btnY + 12, { width: btnW, align: 'center' });
    pdf.link(btnX, btnY, btnW, btnH, paymentUrl);
    pdf.fillColor(GRIS_CLAIR).font('Helvetica').fontSize(7.5)
      .text(paymentUrl, btnX, btnY + btnH + 6, { width: 400 });
    cy += btnH + 26;
  }

  if (banque && (banque.iban || banque.rib || banque.nomBanque)) {
    pdf.fillColor(style.accent).font('Helvetica-Bold').fontSize(8.5).text('PAIEMENT PAR VIREMENT BANCAIRE', 50, cy);
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

function drawInvoiceOrQuote(pdf, { doc, user, isQuote, paymentUrl, logoBuffer }) {
  const devise = user.devise || 'FCFA';
  const statutLabel = isQuote ? STATUT_QUOTE_LABEL[doc.statut] : STATUT_INVOICE_LABEL[doc.statut];
  const statutColor = isQuote ? '#1d4ed8' : STATUT_INVOICE_COLOR[doc.statut];
  const style = styleDe(doc.template);

  let y = drawHeader(pdf, {
    user,
    docTitre: isQuote ? 'DEVIS' : 'FACTURE',
    docNumero: doc.numero,
    statutLabel,
    statutColor,
    dateEmission: doc.dateEmission,
    echeanceLabel: isQuote ? "Valable jusqu'au : " : 'Échéance : ',
    echeanceDate: isQuote ? doc.dateExpiration : doc.dateEcheance,
    logoBuffer,
    style,
  });

  if (doc.objet) {
    pdf.fillColor(GRIS).font('Helvetica-Oblique').fontSize(9.5).text(doc.objet, 50, y, { width: 495 });
    y += 18;
  }

  y = drawClientBlock(pdf, doc.client, y + 6, style);
  y = drawItemsTable(pdf, doc.items, devise, y + 4, style);
  const { y: afterTotals } = drawTotals(pdf, doc, devise, y + 6, style);
  y = afterTotals;

  if (!isQuote && doc.statut !== 'payee' && doc.statut !== 'annulee') {
    y = drawPaymentSection(pdf, { y, paymentUrl, banque: user.banque, devise, montant: calcTotals(doc).ttc, style });
  }

  if (doc.notes) {
    pdf.fillColor(style.accent).font('Helvetica-Bold').fontSize(8.5).text('NOTES', 50, y + 8);
    pdf.fillColor(GRIS).font('Helvetica').fontSize(9).text(doc.notes, 50, y + 22, { width: 495 });
  }

  drawFooter(pdf, isQuote ? 'Devis valable jusqu\'à la date indiquée ci-dessus.' : 'Merci pour votre confiance.');
}

async function buildInvoicePdf({ invoice, user, paymentUrl }) {
  const logoBuffer = await fetchLogoBuffer(user);
  return toBuffer((pdf) => drawInvoiceOrQuote(pdf, { doc: invoice, user, isQuote: false, paymentUrl, logoBuffer }));
}

async function buildQuotePdf({ quote, user }) {
  const logoBuffer = await fetchLogoBuffer(user);
  return toBuffer((pdf) => drawInvoiceOrQuote(pdf, { doc: quote, user, isQuote: true, logoBuffer }));
}

/** Reçu de paiement — document distinct, remis après règlement. */
async function buildReceiptPdf({ invoice, payment, user }) {
  const devise = user.devise || 'FCFA';
  const METHODE_LABEL = {
    especes: 'Espèces', mtn_money: 'MTN Mobile Money', moov_money: 'Moov Money',
    carte: 'Carte bancaire', virement: 'Virement bancaire', autre: 'Autre'
  };

  const logoBuffer = await fetchLogoBuffer(user);
  const style = styleDe(invoice.template);
  return toBuffer((pdf) => {
    let y = drawHeader(pdf, {
      user,
      docTitre: 'REÇU',
      docNumero: payment.receiptNumber || String(payment._id).slice(-8).toUpperCase(),
      statutLabel: 'Payé',
      statutColor: VERT,
      dateEmission: payment.date,
      logoBuffer,
      style,
    });

    y = drawClientBlock(pdf, invoice.client, y + 6, style);

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
      pdf.fillColor(style.accent).font('Helvetica-Bold').fontSize(8.5).text('NOTE', 50, y);
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
