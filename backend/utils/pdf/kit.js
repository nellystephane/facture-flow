'use strict';

// ============================================================================
// Petits outils de dessin partagés par tous les modèles PDF.
// Aucun état global : tout passe en paramètre (génération parallèle sûre).
// Polices : les 14 polices PDF standard (aucun fichier à embarquer), encodage
// WinAnsi — d'où le nettoyage des caractères hors jeu dans clean().
// ============================================================================

const PAGE_W = 595.28;
const PAGE_H = 841.89;

const WIN_ANSI_OK = /[ -~ -ÿ‘’“”–—•…€™Œœ]/;

/** Rend une chaîne sûre pour les polices standard (WinAnsi). */
function clean(value) {
  let s = String(value ?? '').normalize('NFC')
    .replace(/GH₵/g, 'GHS').replace(/₦/g, 'NGN')
    .replace(/ | /g, ' ')
    .replace(/[→➔]/g, '>').replace(/≈/g, '~').replace(/✓/g, '');
  let out = '';
  for (const ch of s) out += WIN_ANSI_OK.test(ch) ? ch : (ch === '\t' || ch === '\n' ? ch : '?');
  return out;
}

/** Sépare « 1 234 567 FCFA » en { num: '1 234 567', cur: 'FCFA' }. */
function splitMoney(text) {
  const s = clean(text);
  const i = s.lastIndexOf(' ');
  return i < 0 ? { num: s, cur: '' } : { num: s.slice(0, i), cur: s.slice(i + 1) };
}

/**
 * Écrit un texte. `o` : font, size, color, w (largeur), align, cs (espacement
 * des lettres), upper, gap (interligne), opacity.
 */
function put(pdf, str, x, y, o = {}) {
  const text = clean(o.upper ? String(str ?? '').toUpperCase() : str);
  pdf.font(o.font || 'Helvetica').fontSize(o.size || 9).fillColor(o.color || '#111111');
  const opts = { lineGap: o.gap || 0 };
  if (o.w) opts.width = o.w;
  if (o.align) opts.align = o.align;
  if (o.cs) opts.characterSpacing = o.cs;
  if (o.lineBreak === false) opts.lineBreak = false;
  if (o.w === undefined && o.lineBreak === undefined) opts.lineBreak = false;
  pdf.text(text, x, y, opts);
  return pdf;
}

/** Hauteur qu'occupera un texte dans une largeur donnée. */
function heightOf(pdf, str, o = {}) {
  pdf.font(o.font || 'Helvetica').fontSize(o.size || 9);
  return pdf.heightOfString(clean(str), { width: o.w, lineGap: o.gap || 0 });
}

function widthOf(pdf, str, o = {}) {
  pdf.font(o.font || 'Helvetica').fontSize(o.size || 9);
  return pdf.widthOfString(clean(str), o.cs ? { characterSpacing: o.cs } : {});
}

/** Petit libellé en capitales espacées (le « détail typographique » signature). */
function label(pdf, str, x, y, o = {}) {
  return put(pdf, str, x, y, { font: 'Helvetica-Bold', size: o.size || 6.6, color: o.color || '#8a8a93', cs: o.cs ?? 1.1, upper: true, w: o.w, align: o.align });
}

function hline(pdf, x0, x1, y, color = '#d8d8dc', w = 0.5, dash = null) {
  pdf.save();
  pdf.lineWidth(w).strokeColor(color);
  if (dash) pdf.dash(dash[0], { space: dash[1] });
  pdf.moveTo(x0, y).lineTo(x1, y).stroke();
  if (dash) pdf.undash();
  pdf.restore();
}

function vline(pdf, x, y0, y1, color = '#d8d8dc', w = 0.5) {
  pdf.save();
  pdf.lineWidth(w).strokeColor(color).moveTo(x, y0).lineTo(x, y1).stroke();
  pdf.restore();
}

function box(pdf, x, y, w, h, { fill, stroke, lw = 0.5, r = 0 } = {}) {
  pdf.save();
  pdf.lineWidth(lw);
  const shape = r ? pdf.roundedRect(x, y, w, h, r) : pdf.rect(x, y, w, h);
  if (fill && stroke) shape.fillAndStroke(fill, stroke);
  else if (fill) shape.fill(fill);
  else if (stroke) shape.stroke(stroke);
  pdf.restore();
}

/** Montant mis en page : chiffre dans la police d'affichage, devise plus petite. */
function bigMoney(pdf, text, x, y, o = {}) {
  const { num, cur } = splitMoney(text);
  const size = o.size || 20;
  const curSize = o.curSize || Math.max(7, size * 0.42);
  const font = o.font || 'Helvetica-Bold';
  const numW = widthOf(pdf, num, { font, size });
  const curW = cur ? widthOf(pdf, cur, { font: o.curFont || 'Helvetica', size: curSize }) : 0;
  const gap = cur ? size * 0.18 : 0;
  const total = numW + gap + curW;
  let px = x;
  if (o.align === 'right') px = x + (o.w || 0) - total;
  else if (o.align === 'center') px = x + ((o.w || 0) - total) / 2;
  put(pdf, num, px, y, { font, size, color: o.color });
  if (cur) {
    // devise alignée sur la ligne de base du grand chiffre
    const asc = (font.startsWith('Times') ? 0.683 : font.startsWith('Courier') ? 0.629 : 0.718);
    const baseGap = (asc * size) - (asc * curSize);
    put(pdf, cur, px + numW + gap, y + baseGap, { font: o.curFont || 'Helvetica', size: curSize, color: o.curColor || o.color });
  }
  return total;
}

/** Lien cliquable : bouton ou texte. */
function link(pdf, x, y, w, h, url) {
  if (url) pdf.link(x, y, w, h, url);
}

module.exports = { PAGE_W, PAGE_H, clean, splitMoney, put, heightOf, widthOf, label, hline, vline, box, bigMoney, link };
