'use strict';

// ============================================================================
// Devises d'un document (facture / devis / paiement).
//
// Règle d'or : la devise est une propriété du DOCUMENT. Tout ce qui touche à
// l'argent d'Oryxa (FedaPay, ledger, reversements, abonnements, affiliation)
// reste en XOF. Une facture en devise étrangère porte un taux figé à
// l'émission (XOF pour 1 unité de la devise) qui sert aux statistiques.
// ============================================================================

const DEVISES = Object.freeze({
  XOF: { code: 'XOF', label: 'FCFA', nom: 'Franc CFA (XOF)', decimales: 0 },
  EUR: { code: 'EUR', label: '€', nom: 'Euro', decimales: 2 },
  USD: { code: 'USD', label: '$', nom: 'Dollar américain', decimales: 2 },
  GBP: { code: 'GBP', label: '£', nom: 'Livre sterling', decimales: 2 },
  CAD: { code: 'CAD', label: 'CA$', nom: 'Dollar canadien', decimales: 2 },
  CHF: { code: 'CHF', label: 'CHF', nom: 'Franc suisse', decimales: 2 },
  MAD: { code: 'MAD', label: 'MAD', nom: 'Dirham marocain', decimales: 2 },
  NGN: { code: 'NGN', label: '₦', nom: 'Naira nigérian', decimales: 2 },
  GHS: { code: 'GHS', label: 'GH₵', nom: 'Cedi ghanéen', decimales: 2 },
  GNF: { code: 'GNF', label: 'GNF', nom: 'Franc guinéen', decimales: 0 },
});

const CODES = Object.freeze(Object.keys(DEVISES));
const DEVISE_DEFAUT = 'XOF';

// Accepte les anciennes valeurs (« FCFA », « F CFA », minuscules…) et retombe sur XOF.
function normalizeDevise(value) {
  const v = String(value || '').toUpperCase().replace(/[\s.]/g, '');
  if (!v || v === 'FCFA' || v === 'FRANCCFA' || v === 'CFA') return DEVISE_DEFAUT;
  return DEVISES[v] ? v : DEVISE_DEFAUT;
}

function isSupported(value) {
  return Boolean(DEVISES[String(value || '').toUpperCase()]);
}

function decimalsOf(devise) {
  return DEVISES[normalizeDevise(devise)].decimales;
}

// Arrondit au plus petit sous-multiple de la devise (entier en XOF, centimes sinon).
function roundMoney(n, devise) {
  const d = decimalsOf(devise);
  const f = 10 ** d;
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * f) / f;
}

// 1 pour le XOF ; sinon le taux fourni s'il est valide, ou null.
function resolveRate(devise, taux) {
  if (normalizeDevise(devise) === DEVISE_DEFAUT) return 1;
  const t = Number(taux);
  return Number.isFinite(t) && t > 0 ? t : null;
}

function toXOF(montant, devise, taux) {
  const r = resolveRate(devise, taux);
  if (r === null) return null;
  return Math.round(Number(montant || 0) * r);
}

// Affichage texte brut (e-mails, messages). Espaces normales : la police PDF
// de base ne sait pas rendre l'espace fine insécable de Intl.
function formatMoney(n, devise) {
  const code = normalizeDevise(devise);
  const d = DEVISES[code].decimales;
  const v = roundMoney(n, code);
  const [ent, dec] = Math.abs(v).toFixed(d).split('.');
  const str = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec ? ',' + dec : '');
  const signe = v < 0 ? '-' : '';
  return `${signe}${str} ${DEVISES[code].label}`;
}

module.exports = { DEVISES, CODES, DEVISE_DEFAUT, normalizeDevise, isSupported, decimalsOf, roundMoney, resolveRate, toXOF, formatMoney };

// Détermine devise + taux à enregistrer sur un document.
//  - création : `existing` absent, repli sur la devise par défaut du compte ;
//  - modification : on ne touche à rien si ni devise ni taux ne sont fournis.
// Retourne { fields } (à fusionner dans les données) ou { error }.
function resolveDocumentCurrency(body, defaultDevise, existing) {
  const b = body || {};
  const hasDevise = b.devise !== undefined && b.devise !== null && b.devise !== '';
  const hasTaux = b.tauxChange !== undefined && b.tauxChange !== null && b.tauxChange !== '';
  if (existing && !hasDevise && !hasTaux) return { fields: {} };
  const brut = String(b.devise || '').toUpperCase().replace(/[\s.]/g, '');
  if (hasDevise && !isSupported(brut) && !['FCFA', 'FRANCCFA', 'CFA'].includes(brut)) {
    return { error: 'Devise non prise en charge.' };
  }
  const code = hasDevise ? normalizeDevise(b.devise) : normalizeDevise(existing ? existing.devise : defaultDevise);
  if (code === DEVISE_DEFAUT) return { fields: { devise: DEVISE_DEFAUT, tauxChange: 1 } };
  const sameAsExisting = existing && normalizeDevise(existing.devise) === code;
  const taux = resolveRate(code, hasTaux ? b.tauxChange : (sameAsExisting ? existing.tauxChange : null));
  if (taux === null) return { error: `Indiquez le taux de change : combien de FCFA vaut 1 ${DEVISES[code].label} ?` };
  return { fields: { devise: code, tauxChange: taux } };
}
module.exports.resolveDocumentCurrency = resolveDocumentCurrency;
