'use strict';

// Calcul des dates de facturation récurrente (logique pure).
// Les dates sont portées à 12h UTC pour qu'aucun décalage de fuseau
// (Bénin = UTC+1) ne fasse changer le jour.

function noonUtc(y, m, d) { return new Date(Date.UTC(y, m, d, 12, 0, 0)); }
function daysInMonth(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }

function prochaineDate(date, frequence, jourAncre) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (frequence === 'hebdomadaire') return noonUtc(y, m, d.getUTCDate() + 7);
  const pas = frequence === 'trimestrielle' ? 3 : frequence === 'annuelle' ? 12 : 1;
  const cible = m + pas;
  const ny = y + Math.floor(cible / 12);
  const nm = ((cible % 12) + 12) % 12;
  const jour = Math.min(jourAncre || d.getUTCDate(), daysInMonth(ny, nm));
  return noonUtc(ny, nm, jour);
}

function aujourdhuiMidi(now = new Date()) {
  const l = new Date(now.getTime() + 3600000);
  return noonUtc(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
}

module.exports = { prochaineDate, noonUtc, aujourdhuiMidi, daysInMonth };
