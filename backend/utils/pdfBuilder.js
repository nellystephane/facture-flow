const { formatMoney: formatMoneyText, normalizeDevise, DEVISES } = require('./currency');
const PDFDocument = require('pdfkit');
const { computeInvoiceTotals } = require('./invoiceTotals');
const { templateOf } = require('./pdf/templates');
const { drawDocument, drawReceipt } = require('./pdf/flow');
const { splitMoney } = require('./pdf/kit');

// ============================================================================
// PDF Oryxa — facture, devis, reçu.
// Ce fichier prépare les DONNÉES (modèle de document) ; la mise en page vit dans
// utils/pdf/ (kit, flow, templates). Neuf modèles, chacun une vraie composition.
// Le paiement en ligne n'est plus un QR : un bouton discret, cliquable, dont
// l'URL vient du serveur (jamais de domaine codé en dur). Le seul QR d'un PDF
// est le sceau fiscal DGI d'une facture normalisée confirmée.
// ============================================================================

// Séparateur de milliers = espace normale (la police PDF de base ne sait pas
// rendre l'espace fine insécable d'Intl) : voir utils/currency.formatMoney.
function formatMontant(n, devise) {
  return formatMoneyText(n, devise);
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Totaux d'un document : source unique partagée avec l'API (utils/invoiceTotals).
// Pour une facture confirmée par la DGI, `ttc` est le total fiscal et
// `arrondiFiscal` l'écart d'arrondi par rapport au calcul HT global.
function calcTotals(doc) {
  const t = computeInvoiceTotals(doc);
  const arrondiFiscal = t.fiscalTotal !== null ? Math.round(t.fiscalTotal - t.totalTTCCalcule) : 0;
  return { sousTotal: t.sousTotal, ht: t.totalHT, montantTva: t.montantTva, taxeSpecifique: t.taxSpecific, arrondiFiscal, ttc: t.totalTTC };
}

/** Exécute un PDFDocument et retourne un Buffer (utile pour pièces jointes email). */
function toBuffer(drawFn) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margins: { top: 0, left: 0, right: 0, bottom: 0 } });
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


const STATUT_INVOICE = {
  brouillon: ['Brouillon', 'muted'], envoyee: ['Envoyée', 'info'], vue: ['Vue par le client', 'info'],
  payee: ['Payée', 'ok'], en_retard: ['En retard', 'bad'], annulee: ['Annulée', 'muted'],
};
const STATUT_QUOTE = {
  brouillon: ['Brouillon', 'muted'], envoye: ['Envoyé', 'info'], accepte: ['Accepté', 'ok'], refuse: ['Refusé', 'bad'], expire: ['Expiré', 'warn'],
};
const METHODE_LABEL = {
  especes: 'Espèces', mtn_money: 'MTN Mobile Money', moov_money: 'Moov Money',
  carte: 'Carte bancaire', virement: 'Virement bancaire', autre: 'Autre',
};

const nombre = (n, devise) => splitMoney(formatMontant(n, devise)).num;

function emitterOf(user) {
  const adresse = user.adresse ? [user.adresse] : [];
  const contact = [user.email, user.telephone].filter(Boolean).join('  ·  ');
  const ifu = user.fiscalisation && user.fiscalisation.ifu ? ['IFU ' + user.fiscalisation.ifu] : [];
  return { nom: user.nom || '', entreprise: user.entreprise || '', lines: [...adresse, ...(contact ? [contact] : []), ...ifu] };
}

function clientOf(client) {
  return { nom: (client && client.nom) || 'Client', lines: [client?.entreprise, client?.email, client?.telephone, client?.adresse].filter(Boolean) };
}

function bankOf(banque) {
  if (!banque || !(banque.iban || banque.rib || banque.nomBanque)) return [];
  return [
    ['Banque', banque.nomBanque], ['Titulaire', banque.titulaire], ['IBAN', banque.iban], ['RIB', banque.rib], ['SWIFT / BIC', banque.swift],
  ].filter(([, v]) => v);
}

/** Modèle de données d'une facture ou d'un devis, indépendant de la mise en page. */
function documentModel({ doc, user, isQuote, paymentUrl, logoBuffer, T }) {
  const devise = normalizeDevise(doc.devise);
  const [statutLabel, statutTone] = (isQuote ? STATUT_QUOTE : STATUT_INVOICE)[doc.statut] || [null, 'muted'];
  const cw = { qty: 46, unit: 92, grp: 60, total: 96, ...(T.colW || {}) };
  const fiscal = doc.fiscalisation || {};
  const confirmed = !isQuote && fiscal.status === 'confirmed' && Array.isArray(fiscal.requestPayload?.items);
  const unpaid = !isQuote && doc.statut !== 'payee' && doc.statut !== 'annulee';
  const devLabel = DEVISES[devise].label;

  let table; let totals;
  if (confirmed) {
    table = {
      columns: [
        { key: 'desc', label: 'Article' },
        { key: 'qty', label: 'Qté', w: cw.qty, align: 'right' },
        { key: 'unit', label: 'Prix TTC', w: cw.unit, align: 'right' },
        { key: 'grp', label: 'Groupe', w: cw.grp, align: 'center' },
        { key: 'total', label: 'Total ligne', w: cw.total, align: 'right' },
      ],
      rows: fiscal.requestPayload.items.map((it) => ({
        cells: {
          desc: String(it.name || ''), qty: String(it.quantity || 0), unit: nombre(it.price || 0, 'XOF'),
          grp: String(it.taxGroup || '—'),
          total: nombre(Math.round(Number(it.price || 0) * Number(it.quantity || 0)) + Number(it.taxSpecific || 0), 'XOF'),
        },
        sub: Number(it.taxSpecific || 0) > 0 ? 'Taxe spécifique incluse : ' + formatMontant(it.taxSpecific, 'XOF') : '',
      })),
    };
    totals = { lines: [], total: { label: 'Total fiscal DGI', value: formatMontant(Number(fiscal.dgiTotal || 0), 'XOF') } };
  } else {
    table = {
      columns: [
        { key: 'desc', label: 'Description' },
        { key: 'qty', label: 'Qté', w: cw.qty, align: 'right' },
        { key: 'unit', label: 'Prix unit.', w: cw.unit, align: 'right' },
        { key: 'total', label: 'Total (' + devLabel.replace('₦', 'NGN').replace('GH₵', 'GHS') + ')', w: cw.total, align: 'right' },
      ],
      rows: (doc.items || []).map((it) => ({
        cells: {
          desc: it.description || '', qty: String(it.quantite || 0), unit: nombre(it.prixUnitaire || 0, devise),
          total: nombre((it.quantite || 0) * (it.prixUnitaire || 0), devise),
        },
        sub: '',
      })),
    };
    const t = calcTotals(doc);
    const normalisee = doc.modeFacturation === 'normalisee';
    const ls = [];
    ls.push({ label: 'Sous-total', value: formatMontant(t.sousTotal, devise) });
    if (doc.remise > 0) ls.push({ label: 'Remise', value: '- ' + formatMontant(doc.remise, devise), tone: 'accent' });
    if (normalisee || t.montantTva > 0) ls.push({ label: normalisee ? 'TVA par groupe fiscal' : 'TVA (' + (doc.tva || 0) + ' %)', value: formatMontant(t.montantTva, devise) });
    if (t.taxeSpecifique > 0) ls.push({ label: 'Taxes spécifiques', value: formatMontant(t.taxeSpecifique, devise) });
    if (t.arrondiFiscal !== 0) ls.push({ label: 'Arrondi fiscal (DGI)', value: (t.arrondiFiscal > 0 ? '+ ' : '- ') + formatMontant(Math.abs(t.arrondiFiscal), devise) });
    // un sous-total seul répète le total : on l'omet
    const lines = ls.length === 1 ? [] : ls;
    totals = { lines, total: { label: normalisee || t.montantTva > 0 ? 'Total TTC' : 'Total', value: formatMontant(t.ttc, devise) } };
  }

  const seal = (!isQuote && fiscal.status === 'confirmed' && fiscal.codeMECeFDGI && fiscal.qrCode)
    ? { code: fiscal.codeMECeFDGI, nim: fiscal.nim, date: fiscal.dateTime, counter: fiscal.counters, qr: fiscal.qrCode }
    : null;

  return {
    kind: isQuote ? 'devis' : 'facture',
    titre: isQuote ? 'Devis' : 'Facture',
    numero: doc.numero || '',
    statut: statutLabel ? { label: statutLabel, tone: statutTone } : null,
    meta: [
      { label: "Date d'émission", value: formatDate(doc.dateEmission) },
      ...((isQuote ? doc.dateExpiration : doc.dateEcheance) ? [{ label: isQuote ? "Valable jusqu'au" : 'Échéance', value: formatDate(isQuote ? doc.dateExpiration : doc.dateEcheance) }] : []),
      ...(statutLabel ? [{ label: 'Statut', value: statutLabel, tone: statutTone }] : []),
    ],
    emetteur: emitterOf(user),
    logo: logoBuffer || null,
    client: clientOf(doc.client),
    objet: doc.objet || '',
    devise,
    deviseLabel: DEVISES[devise].nom,
    table,
    totals,
    pay: unpaid && paymentUrl ? { url: paymentUrl } : null,
    bank: unpaid ? bankOf(user.banque) : [],
    notes: doc.notes || '',
    seal,
    accord: isQuote,
    footer: 'Établi avec Oryxa',
  };
}

function render(model, templateId, drawer) {
  const T = templateOf(templateId);
  return toBuffer((pdf) => drawer(pdf, model, T));
}

async function buildInvoicePdf({ invoice, user, paymentUrl }) {
  const logoBuffer = await fetchLogoBuffer(user);
  const T = templateOf(invoice.template);
  return render(documentModel({ doc: invoice, user, isQuote: false, paymentUrl, logoBuffer, T }), invoice.template, drawDocument);
}

async function buildQuotePdf({ quote, user }) {
  const logoBuffer = await fetchLogoBuffer(user);
  const T = templateOf(quote.template);
  return render(documentModel({ doc: quote, user, isQuote: true, logoBuffer, T }), quote.template, drawDocument);
}

/** Reçu de paiement — document distinct, remis après règlement. */
async function buildReceiptPdf({ invoice, payment, user }) {
  const devise = normalizeDevise((payment && payment.devise) || (invoice && invoice.devise));
  const logoBuffer = await fetchLogoBuffer(user);
  const numero = payment.receiptNumber || String(payment._id).slice(-8).toUpperCase();
  const model = {
    kind: 'recu', titre: 'Reçu', numero, statut: null,
    meta: [{ label: 'Date du paiement', value: formatDate(payment.date) }, { label: 'Statut', value: 'Payé', tone: 'ok' }],
    emetteur: emitterOf(user), logo: logoBuffer || null, client: clientOf(invoice.client), objet: '',
    devise, deviseLabel: DEVISES[devise].nom,
    table: { columns: [], rows: [] }, totals: null, pay: null, bank: [], notes: '', seal: null, accord: false,
    footer: 'Établi avec Oryxa',
    receipt: {
      amount: formatMontant(payment.montant, devise),
      dateShort: formatDate(payment.date),
      rows: [
        ['Facture réglée', invoice.numero],
        ['Moyen de paiement', METHODE_LABEL[payment.methode] || payment.methode || '—'],
        ['Référence', payment.reference || payment.fedapayTransactionId || '—'],
        ['Reçu n°', numero],
      ],
      note: payment.note || '',
    },
  };
  return render(model, invoice.template, drawReceipt);
}

module.exports = {
  toBuffer,
  buildInvoicePdf,
  buildQuotePdf,
  buildReceiptPdf,
  formatMontant,
  calcTotals,
  documentModel,
};
