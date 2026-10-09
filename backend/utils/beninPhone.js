'use strict';

/** Normalise un numéro béninois au format international E.164 (+22901XXXXXXXX). */
function normalizeBeninPhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('229') && digits.length === 13) digits = digits.slice(3);
  if (digits.length === 10 && digits.startsWith('01')) return `+229${digits}`;
  return null;
}

module.exports = { normalizeBeninPhone };
