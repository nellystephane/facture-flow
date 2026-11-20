'use strict';

// ============================================================================
// Déroulé d'un document : en-tête → parties → tableau → totaux (+ colonne de
// gauche : sceau fiscal / virement / bon pour accord) → notes. Les sauts de
// page sont gérés ici ; l'apparence vient du modèle (templates.js).
// ============================================================================

const { PAGE_W, PAGE_H, put, heightOf, widthOf, label, hline, vline, box, bigMoney, link, clean } = require('./kit');
const { drawPaymentQr } = require('../qrcode/qrPdf');
const { toneColor } = require('./templates');

const HB = 'Helvetica-Bold';

function newPage(ctx) {
  ctx.pdf.addPage();
  ctx.page += 1;
  ctx.T.chrome(ctx);
  return ctx.T.top;
}

/** Garantit h points disponibles ; sinon ouvre une page. Retourne le y courant. */
function need(ctx, y, h) {
  return y + h > ctx.T.bottom ? newPage(ctx) : y;
}

// ------------------------------------------------------------------ tableau
function layoutColumns(T, columns, padX) {
  const W = T.x1 - T.x0;
  const fixed = columns.filter((c) => c.w).reduce((s, c) => s + c.w, 0);
  const flexCount = columns.filter((c) => !c.w).length || 1;
  let x = T.x0;
  return columns.map((c) => {
    const w = c.w || (W - fixed) / flexCount;
    const col = { ...c, x, w, tx: x + padX, tw: w - padX * 2 };
    x += w;
    return col;
  });
}

function drawTable(ctx, y) {
  const { pdf, m, T } = ctx;
  const S = T.table;
  const padX = S.head.fill || S.row.grid ? 7 : 0;
  const cols = layoutColumns(T, m.table.columns, padX);
  const W = T.x1 - T.x0;

  const head = (yy) => {
    const h = S.head.h;
    if (S.head.fill) box(pdf, T.x0, yy, W, h, { fill: S.head.fill });
    (S.head.rules || []).forEach((r) => hline(pdf, T.x0, T.x1, r.pos === 'top' ? yy : yy + h, r.color, r.w, r.dash));
    cols.forEach((c) => {
      const isFirst = c.x === T.x0, isLast = c.x + c.w >= T.x1 - 0.5;
      // sans cadre, les colonnes d'extrémité s'alignent sur les marges
      const o = { font: S.head.font, size: S.head.size, color: S.head.color, cs: S.head.cs, upper: true };
      const align = c.align || 'left';
      const ty = yy + (h - S.head.size) / 2 - 0.6;
      put(pdf, c.label, c.tx, ty, { ...o, w: c.tw, align });
      void isFirst; void isLast;
    });
    return yy + h;
  };

  y = head(y);
  const rows = m.table.rows;
  rows.forEach((row, idx) => {
    const descCol = cols[0];
    const bodyFont = T.fonts.body;
    const textH = heightOf(pdf, row.cells[descCol.key], { font: bodyFont, size: S.row.size, w: descCol.tw });
    const subH = row.sub ? 10 : 0;
    const h = Math.max(S.row.minH, textH + subH + S.row.padY * 2);
    if (y + h > T.bottom) { y = newPage(ctx); y = head(y); }
    const ty = y + (h - textH - subH) / 2;
    cols.forEach((c, i) => {
      const val = row.cells[c.key] ?? '';
      if (i === 0) {
        put(pdf, val, c.tx, ty, { font: bodyFont, size: S.row.size, color: T.ink, w: c.tw });
        if (row.sub) put(pdf, row.sub, c.tx, ty + textH + 1.5, { font: T.fonts.body, size: 6.8, color: T.muted, w: c.tw });
      } else {
        const strong = c.key === 'total';
        const font = strong ? T.fonts.numBold : (S.row.numFont || T.fonts.num);
        put(pdf, val, c.tx, y + (h - S.row.size) / 2 - 0.6, { font, size: S.row.size, color: T.ink, w: c.tw, align: c.align || 'right' });
      }
    });
    if (S.row.rule) hline(pdf, T.x0, T.x1, y + h, S.row.rule.color, S.row.rule.w, S.row.rule.dash);
    if (S.row.grid) {
      vline(pdf, T.x0, y, y + h, S.row.grid, 0.5);
      cols.forEach((c) => vline(pdf, c.x + c.w, y, y + h, S.row.grid, 0.5));
    }
    y += h;
    void idx;
  });
  return y + 22;
}

// ------------------------------------------------------------------- totaux
const LINE_H = 17;

function totalsHeight(ctx) {
  const { m, T } = ctx;
  const n = m.totals.lines.length;
  const extra = { rule: 40, minimal: 38, double: 52, framed: 58, grid: 44, inverse: 52, signature: 68 }[T.totals.mode] || 40;
  const base = n * (T.totals.mode === 'grid' ? 20 : LINE_H);
  return base + extra;
}

function drawTotals(ctx, y) {
  const { pdf, m, T } = ctx;
  const S = T.totals;
  const w = S.w, x = T.x1 - w;
  const f = T.fonts;
  const lineLabelFont = f.body, lineValFont = f.numBold;
  const total = m.totals.total;

  if (S.mode === 'grid') {
    // lignes encadrées, total plein
    m.totals.lines.forEach((l) => {
      box(pdf, x, y, w, 20, { stroke: S.ruleColor, lw: 0.5 });
      put(pdf, l.label, x + 8, y + 6.4, { font: lineLabelFont, size: 8.2, color: T.muted });
      put(pdf, l.value, x + 8, y + 6.4, { font: lineValFont, size: 8.6, color: T.ink, w: w - 16, align: 'right' });
      y += 20;
    });
    box(pdf, x, y, w, 32, { fill: S.totalFill });
    put(pdf, total.label.toUpperCase(), x + 10, y + 12, { font: HB, size: 8, color: S.totalColor, cs: 0.8 });
    bigMoney(pdf, total.value, x + 8, y + 8, { size: 14, w: w - 16, align: 'right', font: f.numBold, color: S.totalColor, curColor: S.totalColor });
    return y + 32;
  }

  m.totals.lines.forEach((l) => {
    put(pdf, l.label, x, y, { font: lineLabelFont, size: 8.4, color: T.muted });
    put(pdf, l.value, x, y, { font: lineValFont, size: 8.8, color: l.tone === 'accent' ? T.accent : T.ink, w, align: 'right' });
    y += LINE_H;
  });
  y += 4;

  if (S.mode === 'rule') {
    hline(pdf, x, T.x1, y, S.ruleColor, 0.9);
    put(pdf, total.label, x, y + 14, { font: f.bold, size: 9, color: T.ink });
    bigMoney(pdf, total.value, x + 60, y + 8, { size: 17, w: w - 60, align: 'right', font: f.numBold, color: S.totalColor || T.ink, curColor: S.totalColor || T.ink });
    return y + 38;
  }
  if (S.mode === 'minimal') {
    hline(pdf, x, T.x1, y, T.hair, 0.5);
    label(pdf, total.label, x, y + 16, { size: 6.4, color: T.muted });
    bigMoney(pdf, total.value, x + 60, y + 9, { size: 14, w: w - 60, align: 'right', font: f.numBold, color: T.ink, curColor: T.muted });
    return y + 34;
  }
  if (S.mode === 'double') {
    hline(pdf, x, T.x1, y, S.ruleColor, 0.4);
    hline(pdf, x, T.x1, y + 3, S.ruleColor, 1.1);
    put(pdf, total.label, x, y + 20, { font: S.totalFont, size: 11, color: T.ink });
    bigMoney(pdf, total.value, x + 70, y + 12, { size: 21, w: w - 70, align: 'right', font: S.totalFont, color: S.totalColor, curFont: f.body });
    hline(pdf, x, T.x1, y + 42, S.ruleColor, 1.1);
    hline(pdf, x, T.x1, y + 45, S.ruleColor, 0.4);
    return y + 50;
  }
  if (S.mode === 'framed') {
    box(pdf, x, y, w, 50, { stroke: S.ruleColor, lw: 0.8 });
    box(pdf, x + 3, y + 3, w - 6, 44, { stroke: S.ruleColor, lw: 0.25 });
    put(pdf, total.label.toUpperCase(), x + 14, y + 12, { font: f.bold, size: 7.2, color: S.ruleColor, cs: 1.6 });
    bigMoney(pdf, total.value, x + 12, y + 24, { size: 17, w: w - 24, align: 'right', font: S.totalFont, color: S.totalColor, curFont: f.body });
    return y + 56;
  }
  if (S.mode === 'inverse') {
    box(pdf, x, y, w, 42, { fill: S.totalFill });
    put(pdf, total.label.toUpperCase(), x + 10, y + 17, { font: 'Courier-Bold', size: 8.4, color: S.totalColor });
    bigMoney(pdf, total.value, x + 70, y + 12, { size: 15, w: w - 80, align: 'right', font: 'Courier-Bold', curFont: 'Courier-Bold', color: S.totalColor, curColor: S.totalColor });
    return y + 48;
  }
  if (S.mode === 'signature') {
    hline(pdf, x, T.x1, y, S.ruleColor, 0.9);
    put(pdf, 'Montant à régler', x, y + 10, { font: 'Times-Italic', size: 10.5, color: S.totalColor, w, align: 'right' });
    bigMoney(pdf, total.value, x, y + 24, { size: 28, w, align: 'right', font: 'Times-BoldItalic', color: S.totalColor, curFont: 'Times-Italic', curSize: 11 });
    return y + 66;
  }
  return y + 30;
}

// -------------------------------------------------------------- paiement
function payHeight() { return 52; }

/** Bouton « Payer en ligne » — volontairement discret ; lien cliquable. */
function drawPay(ctx, y) {
  const { pdf, m, T } = ctx;
  if (!m.pay) return 0;
  const P = T.pay;
  const text = 'Payer en ligne';
  const hint = 'Mobile Money, carte ou virement — page sécurisée.';
  const fnt = P.font || HB;
  const tw = widthOf(pdf, text, { font: fnt, size: 8.6, cs: P.style === 'square' ? 0.8 : 0 });
  const right = T.x1;
  let bw = tw + 34, bh = 22;
  let bx = right - bw;

  if (P.style === 'solid') {
    box(pdf, bx, y, bw, bh, { fill: P.color, r: 4 });
    put(pdf, text, bx, y + 7, { font: HB, size: 8.6, color: '#ffffff', w: bw, align: 'center' });
  } else if (P.style === 'pill') {
    box(pdf, bx, y, bw, bh, { stroke: P.color, lw: 0.8, r: 11 });
    put(pdf, text, bx, y + 7, { font: fnt, size: 8.6, color: P.color, w: bw, align: 'center' });
  } else if (P.style === 'square') {
    box(pdf, bx, y, bw, bh, { stroke: P.color, lw: 0.9 });
    put(pdf, text.toUpperCase(), bx, y + 7, { font: HB, size: 7.6, color: P.color, w: bw, align: 'center', cs: 0.8 });
  } else if (P.style === 'mono') {
    const t = '[ PAYER EN LIGNE ]';
    bw = widthOf(pdf, t, { font: 'Courier-Bold', size: 9 }) + 4; bx = right - bw;
    put(pdf, t, bx, y + 4, { font: 'Courier-Bold', size: 9, color: P.color });
    hline(pdf, bx, right, y + 16, P.underline || P.color, 1.4);
    bh = 20;
  } else { // 'link'
    bw = tw + 2; bx = right - bw;
    put(pdf, text, bx, y + 4, { font: HB, size: 9, color: P.color });
    hline(pdf, bx, right, y + 16, P.color, 0.7);
    bh = 20;
  }
  link(pdf, bx, y, bw, bh, m.pay.url);
  put(pdf, hint, T.x1 - 260, y + bh + 6, { font: T.fonts.body === 'Times-Roman' ? 'Times-Italic' : 'Helvetica', size: 6.8, color: T.muted, w: 260, align: 'right' });
  return bh + 22;
}

// ------------------------------------------------- colonne de gauche
const SEAL_H = 104;

function drawSeal(ctx, x, y, w) {
  const { pdf, m } = ctx;
  const s = m.seal;
  if (!s) return 0;
  hline(pdf, x, x + w, y, '#1f7a4d', 0.8);
  label(pdf, 'Facture normalisée · DGI e-MECeF', x, y + 7, { color: '#1f7a4d', size: 6.4, cs: 1 });
  if (s.qr) drawPaymentQr(pdf, s.qr, x, y + 20, 78);
  const tx = x + 88, tw = w - 88;
  let ty = y + 21;
  [['Code MECeF/DGI', s.code], ['NIM', s.nim], ['Date DGI', s.date], ['Compteur', s.counter]].forEach(([k, v]) => {
    label(pdf, k, tx, ty, { size: 5.6, color: '#8a8a93' });
    put(pdf, v || '—', tx, ty + 7.6, { font: 'Courier-Bold', size: 7.4, color: '#16161a', w: tw });
    ty += k === 'Code MECeF/DGI' ? 26 : 19;
  });
  return SEAL_H;
}

// Lignes du bloc virement : les valeurs longues (IBAN) prennent toute la largeur.
function bankRows(m) {
  const rows = [];
  let pending = null;
  m.bank.forEach((it) => {
    if (String(it[1]).length > 22) { if (pending) { rows.push([pending]); pending = null; } rows.push([it]); }
    else if (pending) { rows.push([pending, it]); pending = null; }
    else pending = it;
  });
  if (pending) rows.push([pending]);
  return rows;
}

function bankHeight(m) { return m.bank.length ? 24 + bankRows(m).length * 25 : 0; }

function drawBank(ctx, x, y, w) {
  const { pdf, m, T } = ctx;
  if (!m.bank.length || T.bankInSidebar) return 0;
  hline(pdf, x, x + w, y, T.hair, 0.5);
  label(pdf, 'Règlement par virement', x, y + 7, { color: T.accent === '#0b0b0b' ? '#0b0b0b' : T.accent, size: 6.4 });
  bankRows(m).forEach((row, ri) => {
    row.forEach(([k, v], ci) => {
      const cx = x + ci * (w / 2);
      const cy = y + 22 + ri * 25;
      label(pdf, k, cx, cy, { size: 5.8 });
      put(pdf, v, cx, cy + 8, { font: HB, size: 7.8, color: T.ink, w: row.length === 1 ? w : w / 2 - 8 });
    });
  });
  return bankHeight(m);
}

const ACCORD_H = 84;
function drawAccord(ctx, x, y, w) {
  const { pdf, T } = ctx;
  hline(pdf, x, x + w, y, T.hair, 0.5);
  label(pdf, 'Bon pour accord', x, y + 7, { color: T.accent === '#0b0b0b' ? '#0b0b0b' : T.accent, size: 6.4 });
  put(pdf, 'Date et signature du client, précédées de la mention « Bon pour accord ».', x, y + 20, { size: 6.8, color: T.muted, w });
  hline(pdf, x, x + w * 0.62, y + 72, T.muted, 0.5);
  hline(pdf, x + w * 0.7, x + w, y + 72, T.muted, 0.5);
  label(pdf, 'Signature', x, y + 76, { size: 5.6 });
  label(pdf, 'Date', x + w * 0.7, y + 76, { size: 5.6 });
  return ACCORD_H;
}

function drawBottom(ctx, y) {
  const { pdf, m, T } = ctx;
  const leftW = (T.x1 - T.x0) - T.totals.w - 34;
  const side = leftW >= 200;
  const leftBlocks = [];
  if (m.seal) leftBlocks.push({ h: SEAL_H, draw: (x, yy, w) => drawSeal(ctx, x, yy, w) });
  if (m.bank.length && !T.bankInSidebar) leftBlocks.push({ h: bankHeight(m), draw: (x, yy, w) => drawBank(ctx, x, yy, w) });
  if (m.accord) leftBlocks.push({ h: ACCORD_H, draw: (x, yy, w) => drawAccord(ctx, x, yy, w) });
  const leftH = leftBlocks.reduce((s, b) => s + b.h + 16, 0);
  const rightH = (m.totals ? totalsHeight(ctx) : 0) + (m.pay ? payHeight() : 0);

  if (side) {
    y = need(ctx, y, Math.max(leftH, rightH));
    let ry = y;
    if (m.totals) ry = drawTotals(ctx, ry);
    if (m.pay) { ry += 10; ry += drawPay(ctx, ry); }
    let ly = y;
    leftBlocks.forEach((b) => { b.draw(T.x0, ly, leftW); ly += b.h + 16; });
    y = Math.max(ry, ly);
  } else {
    if (m.totals) { y = need(ctx, y, totalsHeight(ctx)); y = drawTotals(ctx, y); }
    if (m.pay) { y = need(ctx, y + 10, payHeight()); y += drawPay(ctx, y); }
    const fullW = T.x1 - T.x0;
    leftBlocks.forEach((b) => { y = need(ctx, y + 14, b.h); b.draw(T.x0, y, fullW); y += b.h; });
  }

  if (m.notes) {
    const w = T.x1 - T.x0;
    const h = heightOf(pdf, m.notes, { size: 8.4, w });
    y = need(ctx, y + 18, 20 + h);
    label(pdf, 'Notes', T.x0, y, { color: T.accent === '#0b0b0b' ? '#0b0b0b' : T.accent, size: 6.4 });
    put(pdf, m.notes, T.x0, y + 12, { font: T.fonts.body === 'Times-Roman' ? 'Times-Roman' : 'Helvetica', size: T.fonts.body === 'Times-Roman' ? 9.2 : 8.4, color: T.muted, w });
    y += 14 + h;
  }
  return y;
}

// ------------------------------------------------------------ documents
function drawDocument(pdf, m, T) {
  const ctx = { pdf, m, T, page: 1 };
  T.chrome(ctx);
  let y = T.header(ctx);
  y = T.parties(ctx, y);
  y = drawTable(ctx, y);
  drawBottom(ctx, y);
}

function drawReceipt(pdf, m, T) {
  const ctx = { pdf, m, T, page: 1 };
  T.chrome(ctx);
  let y = T.header(ctx);
  y = T.parties(ctx, y);
  const W = T.x1 - T.x0;
  const display = T.fonts.bold === 'Times-Bold' ? 'Times-Bold' : (T.id === 'noir' ? 'Courier-Bold' : 'Helvetica-Bold');
  const col = T.accent === '#0b0b0b' ? '#0b0b0b' : T.accent;

  hline(pdf, T.x0, T.x1, y, T.hair, 0.5);
  label(pdf, 'Montant reçu', T.x0, y + 16, { color: col, size: 6.8 });
  bigMoney(pdf, m.receipt.amount, T.x0, y + 32, { size: 36, font: display, color: T.ink, curFont: T.fonts.body, curColor: T.muted });

  // cachet « Payé » : simple cadre typographique, sans rotation ni effet
  const sw = 96, sh = 44, sx = T.x1 - sw, sy = y + 22;
  const ok = toneColor('ok', T);
  box(pdf, sx, sy, sw, sh, { stroke: ok, lw: 1.1, r: (T.id === 'corporate' || T.id === 'noir') ? 0 : 3 });
  box(pdf, sx + 3, sy + 3, sw - 6, sh - 6, { stroke: ok, lw: 0.3, r: (T.id === 'corporate' || T.id === 'noir') ? 0 : 2 });
  put(pdf, 'PAYÉ', sx, sy + 9, { font: 'Helvetica-Bold', size: 15, color: ok, w: sw, align: 'center', cs: 3 });
  put(pdf, m.receipt.dateShort, sx, sy + 28, { font: 'Helvetica', size: 6.8, color: ok, w: sw, align: 'center' });

  y += 96;
  hline(pdf, T.x0, T.x1, y, T.hair, 0.5);
  y += 16;
  const half = W / 2;
  m.receipt.rows.forEach(([k, v], i) => {
    const cx = T.x0 + (i % 2) * half;
    const cy = y + Math.floor(i / 2) * 38;
    label(pdf, k, cx, cy, { size: 6.2 });
    put(pdf, v, cx, cy + 12, { font: T.fonts.bold, size: 10.4, color: T.ink, w: half - 14 });
  });
  y += Math.ceil(m.receipt.rows.length / 2) * 38 + 6;
  hline(pdf, T.x0, T.x1, y, T.hair, 0.5);
  y += 16;
  if (m.receipt.note) {
    label(pdf, 'Note', T.x0, y, { color: col, size: 6.4 });
    put(pdf, m.receipt.note, T.x0, y + 12, { size: 8.6, color: T.muted, w: W });
    y += 16 + heightOf(pdf, m.receipt.note, { size: 8.6, w: W });
  }
  put(pdf, 'Ce reçu atteste la réception du paiement indiqué ci-dessus.', T.x0, y + 10, { font: T.fonts.body === 'Times-Roman' ? 'Times-Italic' : 'Helvetica', size: 7.6, color: T.muted, w: W });
}

module.exports = { drawDocument, drawReceipt };
void PAGE_W; void PAGE_H; void clean;
