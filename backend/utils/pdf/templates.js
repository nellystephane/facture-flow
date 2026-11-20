'use strict';

// ============================================================================
// Les neuf modèles Oryxa. Chacun est une vraie mise en page (structure,
// typographie, filets, grille) — pas une variation de couleur. Un modèle fournit :
//   - des jetons (bornes, couleurs, polices),
//   - chrome(ctx)  : fond, cadre, pied de page de CHAQUE page,
//   - header(ctx)  : en-tête de la page 1, retourne le y suivant,
//   - parties(ctx, y) : client + références, retourne le y suivant,
//   - table / totals / pay : styles consommés par flow.js.
// ctx = { pdf, m (modèle de données), T (ce modèle), page }
// ============================================================================

const { PAGE_W, PAGE_H, put, heightOf, widthOf, label, hline, vline, box, bigMoney } = require('./kit');

const H = 'Helvetica', HB = 'Helvetica-Bold', HO = 'Helvetica-Oblique';
const TR = 'Times-Roman', TB = 'Times-Bold', TI = 'Times-Italic', TBI = 'Times-BoldItalic';
const C = 'Courier', CB = 'Courier-Bold';

const TONES = { ok: '#1f7a4d', bad: '#b42318', warn: '#9a6a00', info: '#2b5aa8', muted: '#767680' };
const toneColor = (tone, T) => (tone === 'info' ? ((T && (T.infoColor || T.accent)) || TONES.info) : tone === 'muted' ? ((T && T.muted) || TONES.muted) : (TONES[tone] || TONES.muted));

const emitterName = (m) => m.emetteur.entreprise || m.emetteur.nom || '';
const emitterSub = (m) => (m.emetteur.entreprise && m.emetteur.nom ? m.emetteur.nom : '');

function drawLogo(ctx, x, y, size) {
  const { pdf, m } = ctx;
  if (!m.logo) return false;
  try { pdf.image(m.logo, x, y, { fit: [size, size] }); return true; } catch (e) { return false; }
}

/** Lignes d'un bloc de texte (adresse, contacts…), retourne le y suivant. */
function lines(ctx, arr, x, y, o = {}) {
  const { pdf } = ctx;
  const step = o.step || 11.5;
  (arr || []).forEach((l) => {
    const h = heightOf(pdf, l, { font: o.font || H, size: o.size || 8.2, w: o.w });
    put(pdf, l, x, y, { font: o.font || H, size: o.size || 8.2, color: o.color || '#767680', w: o.w, align: o.align });
    y += Math.max(step, h + 2);
  });
  return y;
}

function pageFooter(ctx, o = {}) {
  const { pdf, m, T } = ctx;
  const y = o.y || PAGE_H - 34;
  const left = o.left ?? T.x0;
  const right = o.right ?? T.x1;
  if (o.rule !== false) hline(pdf, left, right, y - 8, o.ruleColor || T.hair, 0.4);
  const txt = `${m.footer}  ·  ${m.titre} ${m.numero}`;
  put(pdf, txt, left, y, { font: o.font || H, size: o.size || 6.8, color: o.color || T.muted, w: right - left, align: o.align || 'left' });
  if (ctx.page > 1 || o.alwaysPage) put(pdf, `Page ${ctx.page}`, left, y, { font: o.font || H, size: o.size || 6.8, color: o.color || T.muted, w: right - left, align: o.align === 'center' ? 'right' : 'right' });
}

// ---------------------------------------------------------------- 1. CLASSIQUE
const classique = {
  id: 'classique', x0: 48, x1: 547, top: 60, bottom: 790,
  ink: '#16161a', muted: '#767680', hair: '#dededf', accent: '#d9524d', infoColor: '#2b5aa8',
  fonts: { body: H, bold: HB, num: H, numBold: HB },
  table: { head: { size: 6.6, color: '#767680', font: HB, cs: 1.1, h: 22, rules: [{ pos: 'bottom', color: '#16161a', w: 0.9 }] }, row: { size: 9, minH: 29, padY: 9, rule: { color: '#e4e4e6', w: 0.4 } } },
  totals: { mode: 'rule', w: 218, ruleColor: '#16161a' },
  pay: { style: 'solid', color: '#d9524d' },
  chrome(ctx) { pageFooter(ctx); },
  header(ctx) {
    const { pdf, m, T } = ctx;
    const hasLogo = drawLogo(ctx, T.x0, 42, 42);
    const tx = hasLogo ? T.x0 + 54 : T.x0;
    put(pdf, emitterName(m), tx, 44, { font: HB, size: 17, color: T.ink, w: 270 });
    let ey = 66;
    if (emitterSub(m)) { put(pdf, emitterSub(m), tx, ey, { size: 8.5, color: T.ink }); ey += 13; }
    ey = lines(ctx, m.emetteur.lines, tx, ey, { w: 270 });
    label(pdf, m.titre, T.x1 - 200, 46, { w: 200, align: 'right', color: T.accent, size: 7.6, cs: 2.4 });
    put(pdf, m.numero, T.x1 - 240, 58, { font: HB, size: 22, color: T.ink, w: 240, align: 'right' });
    const ry = Math.max(ey + 14, 112);
    hline(pdf, T.x0, T.x1, ry, T.hair, 0.5);
    hline(pdf, T.x0, T.x0 + 34, ry, T.accent, 2.4);
    return ry + 20;
  },
  parties(ctx, y) {
    const { pdf, m, T } = ctx;
    label(pdf, m.kind === 'devis' ? 'Destinataire' : 'Facturé à', T.x0, y);
    put(pdf, m.client.nom, T.x0, y + 13, { font: HB, size: 12, color: T.ink, w: 250 });
    let ly = lines(ctx, m.client.lines, T.x0, y + 30, { w: 250, size: 8.5 });
    if (m.objet) { label(pdf, 'Objet', T.x0, ly + 6); put(pdf, m.objet, T.x0, ly + 18, { size: 9, color: T.ink, w: 250 }); ly += 18 + heightOf(pdf, m.objet, { size: 9, w: 250 }) + 4; }
    let ry = y;
    m.meta.forEach((r, i) => {
      if (i) hline(pdf, 330, T.x1, ry - 5, T.hair, 0.4);
      put(pdf, r.label, 330, ry, { size: 8, color: T.muted });
      put(pdf, r.value, 330, ry, { font: HB, size: 8.6, color: r.tone ? toneColor(r.tone, T) : T.ink, w: T.x1 - 330, align: 'right' });
      ry += 19;
    });
    return Math.max(ly, ry) + 22;
  },
};

// ---------------------------------------------------------------- 2. MODERNE
const moderne = {
  id: 'moderne', x0: 48, x1: 547, top: 60, bottom: 790,
  ink: '#101114', muted: '#6c6f78', hair: '#dcdde2', accent: '#2447d6',
  fonts: { body: H, bold: HB, num: H, numBold: HB },
  table: { head: { size: 6.8, color: '#101114', font: HB, cs: 0.9, h: 24, rules: [{ pos: 'top', color: '#101114', w: 1.2 }, { pos: 'bottom', color: '#dcdde2', w: 0.5 }] }, row: { size: 9, minH: 28, padY: 9, rule: { color: '#e9eaee', w: 0.4 } } },
  totals: { mode: 'rule', w: 218, ruleColor: '#101114', totalColor: '#2447d6' },
  pay: { style: 'pill', color: '#2447d6' },
  chrome(ctx) { pageFooter(ctx); },
  header(ctx) {
    const { pdf, m, T } = ctx;
    put(pdf, m.titre, T.x0 - 2, 34, { font: HB, size: 44, color: T.ink, cs: -1.2 });
    label(pdf, 'Numéro', T.x1 - 150, 44, { w: 150, align: 'right' });
    put(pdf, m.numero, T.x1 - 200, 55, { font: HB, size: 15, color: T.accent, w: 200, align: 'right' });
    if (m.statut) put(pdf, m.statut.label, T.x1 - 200, 76, { font: HB, size: 8, color: toneColor(m.statut.tone, T), w: 200, align: 'right' });
    hline(pdf, T.x0, T.x1, 100, T.ink, 1.6);
    return 100;
  },
  parties(ctx, y) {
    const { pdf, m, T } = ctx;
    const gx = T.x0, cx = 176, cw = T.x1 - cx;
    const section = (name, drawFn, h) => {
      label(pdf, name, gx, y + 15, { color: T.accent });
      drawFn(y + 12);
      y += h;
      hline(pdf, T.x0, T.x1, y, T.hair, 0.5);
    };
    const eh = 24 + (emitterSub(m) ? 13 : 0) + m.emetteur.lines.length * 11.5;
    section('Émetteur', (yy) => {
      put(pdf, emitterName(m), cx, yy, { font: HB, size: 11, color: T.ink, w: cw });
      let ly = yy + 16;
      if (emitterSub(m)) { put(pdf, emitterSub(m), cx, ly, { size: 8.5, color: T.ink }); ly += 13; }
      lines(ctx, m.emetteur.lines, cx, ly, { w: cw });
    }, eh + 8);
    const ch = 28 + m.client.lines.length * 11.5;
    section(m.kind === 'devis' ? 'Destinataire' : 'Facturé à', (yy) => {
      put(pdf, m.client.nom, cx, yy, { font: HB, size: 11, color: T.ink, w: cw });
      lines(ctx, m.client.lines, cx, yy + 16, { w: cw });
    }, ch + 8);
    section('Dates', (yy) => {
      let px = cx;
      m.meta.filter((r) => r.label !== 'Statut').forEach((r) => {
        label(pdf, r.label, px, yy - 2, { size: 6.2 });
        put(pdf, r.value, px, yy + 9, { font: HB, size: 9, color: T.ink });
        px += 140;
      });
    }, 40);
    if (m.objet) {
      const oh = heightOf(pdf, m.objet, { size: 9.2, w: cw });
      section('Objet', (yy) => put(pdf, m.objet, cx, yy, { size: 9.2, color: T.ink, w: cw }), oh + 22);
    }
    return y + 18;
  },
};

// ---------------------------------------------------------------- 3. MINIMAL
const minimal = {
  id: 'minimal', x0: 70, x1: 525, top: 70, bottom: 780,
  ink: '#1b1b1d', muted: '#8d8d95', hair: '#e6e6e9', accent: '#1b1b1d',
  fonts: { body: H, bold: HB, num: H, numBold: HB },
  table: { head: { size: 6.2, color: '#8d8d95', font: H, cs: 1.4, h: 22, rules: [{ pos: 'bottom', color: '#e6e6e9', w: 0.5 }] }, row: { size: 8.8, minH: 32, padY: 11, rule: { color: '#eeeef0', w: 0.4 } } },
  totals: { mode: 'minimal', w: 200, ruleColor: '#1b1b1d' },
  pay: { style: 'link', color: '#1b1b1d' },
  chrome(ctx) { pageFooter(ctx, { size: 6.4, rule: false }); },
  header(ctx) {
    const { pdf, m, T } = ctx;
    const hasLogo = drawLogo(ctx, T.x0, 62, 30);
    const tx = hasLogo ? T.x0 + 42 : T.x0;
    put(pdf, emitterName(m), tx, 64, { font: HB, size: 9.5, color: T.ink, w: 240 });
    let ey = 78;
    if (emitterSub(m)) { put(pdf, emitterSub(m), tx, ey, { size: 7.8, color: T.muted }); ey += 11; }
    ey = lines(ctx, m.emetteur.lines, tx, ey, { size: 7.6, step: 10.5, w: 240 });
    put(pdf, `${m.titre}  ${m.numero}`, T.x1 - 220, 64, { font: H, size: 9.5, color: T.ink, w: 220, align: 'right' });
    if (m.statut) put(pdf, m.statut.label, T.x1 - 220, 78, { size: 7.6, color: toneColor(m.statut.tone, T), w: 220, align: 'right' });
    return Math.max(ey, 100) + 52;
  },
  parties(ctx, y) {
    const { pdf, m, T } = ctx;
    label(pdf, m.kind === 'devis' ? 'Pour' : 'Facturé à', T.x0, y, { size: 6.0 });
    put(pdf, m.client.nom, T.x0, y + 12, { font: H, size: 10.5, color: T.ink, w: 230 });
    let ly = lines(ctx, m.client.lines, T.x0, y + 28, { size: 8, w: 230, step: 11 });
    let rx = T.x0 + 260;
    m.meta.filter((r) => r.label !== 'Statut').forEach((r) => {
      label(pdf, r.label, rx, y, { size: 6.0 });
      put(pdf, r.value, rx, y + 12, { size: 8.8, color: T.ink });
      rx += 100;
    });
    if (m.objet) { put(pdf, m.objet, T.x0 + 260, y + 36, { size: 8.4, color: T.muted, w: T.x1 - T.x0 - 260 }); }
    return Math.max(ly, y + 56) + 34;
  },
};

// ---------------------------------------------------------------- 4. ATELIER
const atelier = {
  id: 'atelier', x0: 58, x1: 537, top: 64, bottom: 776,
  ink: '#26221c', muted: '#7d756a', hair: '#d9d0bf', accent: '#2f5d4b', bg: '#faf6ee',
  fonts: { body: TR, bold: TB, num: TR, numBold: TB },
  table: { head: { size: 9, color: '#7d756a', font: TI, cs: 0, h: 24, rules: [{ pos: 'bottom', color: '#8c8272', w: 0.5, dash: [0.6, 2.2] }] }, row: { size: 10.4, minH: 31, padY: 10, rule: { color: '#b9ae99', w: 0.5, dash: [0.6, 2.2] } } },
  totals: { mode: 'double', w: 220, ruleColor: '#26221c', totalColor: '#2f5d4b', totalFont: TB },
  pay: { style: 'pill', color: '#2f5d4b', font: TI },
  chrome(ctx) {
    const { pdf, T } = ctx;
    pdf.rect(0, 0, PAGE_W, PAGE_H).fill(T.bg);
    pageFooter(ctx, { font: TI, size: 8, align: 'center', rule: false, y: PAGE_H - 40 });
  },
  header(ctx) {
    const { pdf, m, T } = ctx;
    const hasLogo = drawLogo(ctx, T.x0, 46, 40);
    const tx = hasLogo ? T.x0 + 52 : T.x0;
    put(pdf, emitterName(m), tx, 48, { font: TB, size: 24, color: T.ink, w: 280 });
    let ey = 48 + (heightOf(pdf, emitterName(m), { font: TB, size: 24, w: 280 })) + 4;
    if (emitterSub(m)) { put(pdf, emitterSub(m), tx, ey, { font: TI, size: 10, color: T.muted }); ey += 14; }
    ey = lines(ctx, m.emetteur.lines, tx, ey, { font: TR, size: 9, color: T.muted, w: 280, step: 12 });
    put(pdf, m.titre, T.x1 - 220, 44, { font: TI, size: 32, color: T.accent, w: 220, align: 'right' });
    put(pdf, 'n° ' + m.numero, T.x1 - 220, 84, { font: TR, size: 11, color: T.muted, w: 220, align: 'right' });
    const ry = Math.max(ey + 12, 116);
    hline(pdf, T.x0, T.x1, ry, T.ink, 1.3);
    hline(pdf, T.x0, T.x1, ry + 3.6, T.ink, 0.4);
    return ry + 26;
  },
  parties(ctx, y) {
    const { pdf, m, T } = ctx;
    put(pdf, m.kind === 'devis' ? 'Pour' : 'À l’attention de', T.x0, y, { font: TI, size: 9.5, color: T.muted });
    put(pdf, m.client.nom, T.x0, y + 13, { font: TB, size: 14, color: T.ink, w: 260 });
    let ly = lines(ctx, m.client.lines, T.x0, y + 33, { font: TR, size: 9.5, color: T.muted, w: 260, step: 12.5 });
    let ry = y;
    m.meta.forEach((r) => {
      put(pdf, r.label, 345, ry, { font: TI, size: 9.5, color: T.muted });
      put(pdf, r.value, 345, ry, { font: TR, size: 10, color: r.tone ? toneColor(r.tone, T) : T.ink, w: T.x1 - 345, align: 'right' });
      ry += 16;
    });
    if (m.objet) { put(pdf, m.objet, T.x0, ly + 8, { font: TI, size: 10, color: T.ink, w: 280 }); ly += 10 + heightOf(pdf, m.objet, { font: TI, size: 10, w: 280 }); }
    return Math.max(ly, ry) + 26;
  },
};

// ---------------------------------------------------------------- 5. HORIZON
const HZ_SIDE = '#16283d';
const horizon = {
  id: 'horizon', x0: 208, x1: 549, top: 60, bottom: 786,
  ink: '#14202e', muted: '#6a7686', hair: '#dfe3e9', accent: '#16283d',
  colW: { qty: 30, unit: 64, grp: 44, total: 74 },
  fonts: { body: H, bold: HB, num: H, numBold: HB },
  bankInSidebar: true,
  table: { head: { size: 6.4, color: '#14202e', font: HB, cs: 0.9, h: 24, fill: '#eaeef3' }, row: { size: 8.8, minH: 28, padY: 9, rule: { color: '#e4e8ed', w: 0.4 } } },
  totals: { mode: 'rule', w: 205, ruleColor: '#14202e', totalColor: '#14202e' },
  pay: { style: 'pill', color: '#16283d' },
  chrome(ctx) {
    const { pdf, m, T } = ctx;
    pdf.rect(0, 0, 178, PAGE_H).fill(HZ_SIDE);
    put(pdf, `${m.footer}  ·  ${m.numero}`, T.x0, PAGE_H - 34, { size: 6.8, color: T.muted, w: T.x1 - T.x0 });
    if (ctx.page > 1) put(pdf, `Page ${ctx.page}`, T.x0, PAGE_H - 34, { size: 6.8, color: T.muted, w: T.x1 - T.x0, align: 'right' });
  },
  header(ctx) {
    const { pdf, m, T } = ctx;
    const light = '#f3eee4', soft = '#b4c0cf', peach = '#e9b384';
    const hasLogo = drawLogo(ctx, 28, 40, 44);
    let sy = hasLogo ? 96 : 46;
    put(pdf, emitterName(m), 28, sy, { font: HB, size: 13, color: light, w: 126 });
    sy += heightOf(pdf, emitterName(m), { font: HB, size: 13, w: 126 }) + 5;
    if (emitterSub(m)) { put(pdf, emitterSub(m), 28, sy, { size: 8, color: soft, w: 126 }); sy += 12; }
    lines(ctx, m.emetteur.lines, 28, sy, { size: 7.6, color: soft, w: 126, step: 10.5 });
    // références du document dans la marge
    let ry = 300;
    const ref = (k, v, tone) => { label(pdf, k, 28, ry, { color: peach, size: 6.2 }); put(pdf, v, 28, ry + 11, { font: HB, size: 10, color: tone ? '#ffffff' : light, w: 126 }); ry += 36; };
    ref(m.titre + ' n°', m.numero);
    m.meta.forEach((r) => ref(r.label, r.value));
    if (m.bank.length) {
      let by = 560;
      label(pdf, 'Virement', 28, by, { color: peach, size: 6.2 }); by += 15;
      m.bank.forEach(([k, v]) => {
        put(pdf, k, 28, by, { size: 6.4, color: soft, w: 126 });
        const vh = heightOf(pdf, v, { font: HB, size: 7.4, w: 126 });
        put(pdf, v, 28, by + 8.4, { font: HB, size: 7.4, color: light, w: 126 });
        by += 8.4 + vh + 7;
      });
    }
    put(pdf, m.titre, T.x0, 48, { font: HB, size: 34, color: T.ink, cs: -0.8 });
    return 112;
  },
  parties(ctx, y) {
    const { pdf, m, T } = ctx;
    label(pdf, m.kind === 'devis' ? 'Destinataire' : 'Facturé à', T.x0, y, { color: '#c8895a' });
    put(pdf, m.client.nom, T.x0, y + 13, { font: HB, size: 13, color: T.ink, w: T.x1 - T.x0 });
    let ly = lines(ctx, m.client.lines, T.x0, y + 31, { size: 8.6, w: T.x1 - T.x0 });
    if (m.objet) { put(pdf, m.objet, T.x0, ly + 6, { font: HO, size: 9, color: T.ink, w: T.x1 - T.x0 }); ly += 8 + heightOf(pdf, m.objet, { font: HO, size: 9, w: T.x1 - T.x0 }); }
    return ly + 26;
  },
};

// ---------------------------------------------------------------- 6. PRESTIGE
const GOLD = '#98772a';
const prestige = {
  id: 'prestige', x0: 64, x1: 531, top: 84, bottom: 764,
  ink: '#2a2620', muted: '#7a7366', hair: '#e3dcc9', accent: GOLD, bg: '#fbf8f1',
  fonts: { body: TR, bold: TB, num: TR, numBold: TB },
  table: { head: { size: 8, color: GOLD, font: TB, cs: 1.6, h: 24, rules: [{ pos: 'top', color: GOLD, w: 0.7 }, { pos: 'bottom', color: GOLD, w: 0.7 }] }, row: { size: 10.2, minH: 30, padY: 10, rule: { color: '#e6dfcd', w: 0.4 } } },
  totals: { mode: 'framed', w: 215, ruleColor: GOLD, totalColor: '#2a2620', totalFont: TB },
  pay: { style: 'pill', color: GOLD, font: TB },
  chrome(ctx) {
    const { pdf, T } = ctx;
    pdf.rect(0, 0, PAGE_W, PAGE_H).fill(T.bg);
    box(pdf, 22, 22, PAGE_W - 44, PAGE_H - 44, { stroke: GOLD, lw: 0.8 });
    box(pdf, 27, 27, PAGE_W - 54, PAGE_H - 54, { stroke: GOLD, lw: 0.25 });
    pageFooter(ctx, { font: TI, size: 8, align: 'center', rule: false, y: PAGE_H - 52 });
  },
  header(ctx) {
    const { pdf, m, T } = ctx;
    const cw = T.x1 - T.x0;
    let y = 58;
    if (drawLogo(ctx, PAGE_W / 2 - 18, 52, 36)) y = 96;
    put(pdf, emitterName(m), T.x0, y, { font: TB, size: 21, color: T.ink, w: cw, align: 'center' });
    y += heightOf(pdf, emitterName(m), { font: TB, size: 21, w: cw }) + 4;
    if (emitterSub(m)) { put(pdf, emitterSub(m), T.x0, y, { font: TI, size: 10, color: T.muted, w: cw, align: 'center' }); y += 14; }
    y = lines(ctx, m.emetteur.lines, T.x0, y, { font: TR, size: 8.8, color: T.muted, w: cw, align: 'center', step: 12 });
    hline(pdf, PAGE_W / 2 - 22, PAGE_W / 2 + 22, y + 6, GOLD, 0.8);
    put(pdf, m.titre.toUpperCase(), T.x0, y + 20, { font: TB, size: 11.5, color: GOLD, w: cw, align: 'center', cs: 6 });
    put(pdf, 'n° ' + m.numero, T.x0, y + 38, { font: TI, size: 11.5, color: T.muted, w: cw, align: 'center' });
    return y + 70;
  },
  parties(ctx, y) {
    const { pdf, m, T } = ctx;
    put(pdf, m.kind === 'devis' ? 'POUR' : 'ADRESSÉ À', T.x0, y, { font: TB, size: 7.6, color: GOLD, cs: 1.8 });
    put(pdf, m.client.nom, T.x0, y + 14, { font: TB, size: 13.5, color: T.ink, w: 230 });
    let ly = lines(ctx, m.client.lines, T.x0, y + 33, { font: TR, size: 9.6, color: T.muted, w: 230, step: 12.5 });
    vline(pdf, 322, y, Math.max(ly, y + 62), GOLD, 0.35);
    let ry = y;
    m.meta.forEach((r) => {
      put(pdf, r.label, 342, ry, { font: TI, size: 9.4, color: T.muted });
      put(pdf, r.value, 342, ry + 12, { font: TB, size: 10.2, color: r.tone ? toneColor(r.tone, T) : T.ink });
      ry += 30;
    });
    if (m.objet) { put(pdf, m.objet, T.x0, ly + 8, { font: TI, size: 10, color: T.ink, w: 250 }); ly += 10 + heightOf(pdf, m.objet, { font: TI, size: 10, w: 250 }); }
    return Math.max(ly, ry) + 22;
  },
};

// ---------------------------------------------------------------- 7. CORPORATE
const NAVY = '#14284b';
const corporate = {
  id: 'corporate', x0: 40, x1: 555, top: 56, bottom: 790,
  ink: '#1a1a1f', muted: '#5b6472', hair: '#c9ced6', accent: NAVY,
  fonts: { body: H, bold: HB, num: H, numBold: HB },
  table: { head: { size: 6.8, color: '#ffffff', font: HB, cs: 0.9, h: 24, fill: NAVY }, row: { size: 8.8, minH: 25, padY: 8, rule: { color: '#c9ced6', w: 0.5 }, grid: '#c9ced6' } },
  totals: { mode: 'grid', w: 224, ruleColor: '#c9ced6', totalColor: '#ffffff', totalFill: NAVY },
  pay: { style: 'square', color: NAVY },
  chrome(ctx) { pageFooter(ctx, { ruleColor: '#c9ced6' }); },
  header(ctx) {
    const { pdf, m, T } = ctx;
    const hasLogo = drawLogo(ctx, T.x0, 42, 44);
    const tx = hasLogo ? T.x0 + 56 : T.x0;
    put(pdf, emitterName(m), tx, 42, { font: HB, size: 16, color: T.ink, w: 300 });
    let ey = 62;
    if (emitterSub(m)) { put(pdf, emitterSub(m), tx, ey, { size: 8.6, color: T.ink }); ey += 12; }
    lines(ctx, m.emetteur.lines, tx, ey, { size: 8, w: 300, step: 11 });
    box(pdf, T.x1 - 158, 40, 158, 58, { fill: NAVY });
    put(pdf, m.titre.toUpperCase(), T.x1 - 158, 51, { font: HB, size: 15, color: '#ffffff', w: 158, align: 'center', cs: 2.4 });
    put(pdf, 'N° ' + m.numero, T.x1 - 158, 74, { font: HB, size: 9.2, color: '#d6dcea', w: 158, align: 'center' });
    // bandeau de références en cellules
    const cells = m.meta.concat(m.devise && m.devise !== 'XOF' ? [{ label: 'Devise', value: m.deviseLabel }] : []);
    const cy = 112, ch = 34, cw = (T.x1 - T.x0) / Math.max(1, cells.length);
    box(pdf, T.x0, cy, T.x1 - T.x0, ch, { stroke: T.hair, lw: 0.6 });
    cells.forEach((c, i) => {
      if (i) vline(pdf, T.x0 + cw * i, cy, cy + ch, T.hair, 0.6);
      label(pdf, c.label, T.x0 + cw * i + 9, cy + 7, { size: 6, color: T.muted });
      put(pdf, c.value, T.x0 + cw * i + 9, cy + 18, { font: HB, size: 9, color: c.tone ? toneColor(c.tone, T) : T.ink, w: cw - 14 });
    });
    return cy + ch + 14;
  },
  parties(ctx, y) {
    const { pdf, m, T } = ctx;
    const gap = 12, w = (T.x1 - T.x0 - gap) / 2;
    const blocks = [
      { title: m.kind === 'devis' ? 'Destinataire' : 'Client', name: m.client.nom, ls: m.client.lines },
      { title: 'Objet / référence', name: m.objet || '—', ls: [], plain: true },
    ];
    const h = 20 + Math.max(blocks[0].ls.length * 11.5 + 28, 46);
    blocks.forEach((b, i) => {
      const x = T.x0 + i * (w + gap);
      box(pdf, x, y, w, h, { stroke: T.hair, lw: 0.6 });
      box(pdf, x, y, w, 15, { fill: NAVY });
      label(pdf, b.title, x + 9, y + 4.6, { color: '#ffffff', size: 6.4 });
      put(pdf, b.name, x + 9, y + 24, { font: b.plain ? H : HB, size: b.plain ? 9 : 10.5, color: T.ink, w: w - 18 });
      if (b.ls.length) lines(ctx, b.ls, x + 9, y + 40, { size: 8.3, w: w - 18, step: 11.5 });
    });
    return y + h + 20;
  },
};

// ---------------------------------------------------------------- 8. SIGNATURE
const BORD = '#6e1d3a';
const signature = {
  id: 'signature', x0: 58, x1: 537, top: 64, bottom: 776,
  ink: '#231a1e', muted: '#85787c', hair: '#e8dfe2', accent: BORD,
  fonts: { body: H, bold: HB, num: H, numBold: HB },
  table: { head: { size: 9.4, color: BORD, font: TI, cs: 0, h: 24, rules: [{ pos: 'bottom', color: BORD, w: 0.8 }] }, row: { size: 9.2, minH: 29, padY: 9, rule: { color: '#ece4e7', w: 0.4 } } },
  totals: { mode: 'signature', w: 205, ruleColor: BORD, totalColor: BORD },
  pay: { style: 'link', color: BORD },
  chrome(ctx) { pageFooter(ctx, { ruleColor: '#ece4e7' }); },
  header(ctx) {
    const { pdf, m, T } = ctx;
    const hasLogo = drawLogo(ctx, T.x0, 44, 38);
    const tx = hasLogo ? T.x0 + 50 : T.x0;
    const maxW = 320 - (tx - T.x0);
    let size = 28;
    while (size > 16 && widthOf(pdf, emitterName(m), { font: TBI, size }) > maxW) size -= 1;
    put(pdf, emitterName(m), tx, 46, { font: TBI, size, color: BORD, w: maxW, lineBreak: false });
    const fy = 46 + size * 1.14 + 5;
    pdf.save(); pdf.lineWidth(0.9).strokeColor(BORD);
    pdf.moveTo(tx, fy + 4).bezierCurveTo(tx + 60, fy - 3, tx + 130, fy + 9, tx + Math.min(260, maxW), fy + 1).stroke();
    pdf.restore();
    let ey = fy + 16;
    if (emitterSub(m)) { put(pdf, emitterSub(m), tx, ey, { size: 8.6, color: T.ink }); ey += 12; }
    ey = lines(ctx, m.emetteur.lines, tx, ey, { size: 8, w: 320, step: 11 });
    label(pdf, m.titre, T.x1 - 180, 50, { w: 180, align: 'right', cs: 3, color: T.muted, size: 7.2 });
    put(pdf, m.numero, T.x1 - 220, 63, { font: HB, size: 13, color: T.ink, w: 220, align: 'right' });
    if (m.statut) put(pdf, m.statut.label, T.x1 - 220, 82, { font: HO, size: 9, color: toneColor(m.statut.tone, T), w: 220, align: 'right' });
    return Math.max(ey + 12, 126) + 6;
  },
  parties(ctx, y) {
    const { pdf, m, T } = ctx;
    put(pdf, m.kind === 'devis' ? 'Pour' : 'Facturé à', T.x0, y, { font: TI, size: 10.5, color: BORD });
    put(pdf, m.client.nom, T.x0, y + 14, { font: HB, size: 12.5, color: T.ink, w: 260 });
    let ly = lines(ctx, m.client.lines, T.x0, y + 32, { size: 8.6, w: 260 });
    let rx = 350, ry = y;
    m.meta.filter((r) => r.label !== 'Statut').forEach((r) => {
      put(pdf, r.label, rx, ry, { font: TI, size: 9.5, color: BORD });
      put(pdf, r.value, rx, ry + 12, { font: HB, size: 9.2, color: T.ink });
      ry += 30;
    });
    if (m.objet) { put(pdf, m.objet, T.x0, ly + 8, { font: HO, size: 9, color: T.ink, w: 280 }); ly += 10 + heightOf(pdf, m.objet, { font: HO, size: 9, w: 280 }); }
    return Math.max(ly, ry) + 24;
  },
};

// ---------------------------------------------------------------- 9. NOIR
const noir = {
  id: 'noir', x0: 44, x1: 551, top: 60, bottom: 786,
  ink: '#0b0b0b', muted: '#4d4d4d', hair: '#0b0b0b', accent: '#0b0b0b', amber: '#e8a317',
  fonts: { body: H, bold: HB, num: CB, numBold: CB },
  table: { head: { size: 7.4, color: '#ffffff', font: CB, cs: 0.8, h: 23, fill: '#0b0b0b' }, row: { size: 8.8, minH: 27, padY: 8, rule: { color: '#0b0b0b', w: 0.4, dash: [1.6, 1.6] }, numFont: CB } },
  totals: { mode: 'inverse', w: 232, ruleColor: '#0b0b0b', totalColor: '#ffffff', totalFill: '#0b0b0b' },
  pay: { style: 'mono', color: '#0b0b0b', underline: '#e8a317' },
  chrome(ctx) {
    const { pdf, T } = ctx;
    pdf.rect(T.x0, 32, T.x1 - T.x0, 5).fill('#0b0b0b');
    pageFooter(ctx, { font: C, size: 6.8, color: '#0b0b0b', ruleColor: '#0b0b0b' });
  },
  header(ctx) {
    const { pdf, m, T } = ctx;
    const hasLogo = drawLogo(ctx, T.x0, 52, 36);
    const tx = hasLogo ? T.x0 + 48 : T.x0;
    put(pdf, emitterName(m), tx, 54, { font: HB, size: 14.5, color: T.ink, w: 250, upper: true, cs: 0.7 });
    let ey = 54 + heightOf(pdf, emitterName(m).toUpperCase(), { font: HB, size: 14.5, w: 250 }) + 4;
    if (emitterSub(m)) { put(pdf, emitterSub(m), tx, ey, { font: C, size: 8, color: T.ink }); ey += 11; }
    ey = lines(ctx, m.emetteur.lines, tx, ey, { font: C, size: 7.8, color: T.ink, w: 250, step: 10.5 });
    put(pdf, m.titre.toUpperCase(), T.x1 - 260, 48, { font: CB, size: 30, color: T.ink, w: 260, align: 'right', cs: -0.5 });
    put(pdf, 'NO ' + m.numero, T.x1 - 260, 86, { font: CB, size: 11, color: T.ink, w: 260, align: 'right' });
    const ry = Math.max(ey + 12, 112);
    hline(pdf, T.x0, T.x1, ry, T.ink, 1.6);
    return ry + 18;
  },
  parties(ctx, y) {
    const { pdf, m, T } = ctx;
    put(pdf, m.kind === 'devis' ? 'DESTINATAIRE' : 'FACTURE A', T.x0, y, { font: CB, size: 7.4, color: T.ink, cs: 0.8 });
    put(pdf, m.client.nom, T.x0, y + 13, { font: HB, size: 12.5, color: T.ink, w: 260 });
    let ly = lines(ctx, m.client.lines, T.x0, y + 31, { font: C, size: 8.2, color: T.ink, w: 260, step: 10.8 });
    let ry = y;
    m.meta.forEach((r) => {
      put(pdf, r.label.toUpperCase().replace(/[ÉÈ]/g, 'E') + ' :', 340, ry, { font: C, size: 8, color: T.ink });
      put(pdf, r.value, 340, ry, { font: CB, size: 8.4, color: T.ink, w: T.x1 - 340, align: 'right' });
      ry += 14;
    });
    if (m.objet) { put(pdf, m.objet, T.x0, ly + 6, { font: C, size: 8.4, color: T.ink, w: 280 }); ly += 8 + heightOf(pdf, m.objet, { font: C, size: 8.4, w: 280 }); }
    return Math.max(ly, ry) + 20;
  },
};

const TEMPLATES = { classique, moderne, minimal, atelier, horizon, prestige, corporate, signature, noir };

function templateOf(id) { return TEMPLATES[id] || classique; }

module.exports = { TEMPLATES, templateOf, toneColor, emitterName, emitterSub, lines };
