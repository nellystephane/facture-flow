const { prochaineDate, noonUtc } = require('../utils/recurring');

describe('recurring', () => {
  test('mensuel : le 31 janvier donne fin février puis revient au 31 mars', () => {
    const fev = prochaineDate(noonUtc(2026, 0, 31), 'mensuelle', 31);
    expect(fev.toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(prochaineDate(fev, 'mensuelle', 31).toISOString().slice(0, 10)).toBe('2026-03-31');
  });
  test('hebdomadaire, trimestrielle, annuelle', () => {
    expect(prochaineDate(noonUtc(2026, 10, 18), 'hebdomadaire', 18).toISOString().slice(0, 10)).toBe('2026-11-25');
    expect(prochaineDate(noonUtc(2026, 10, 18), 'trimestrielle', 18).toISOString().slice(0, 10)).toBe('2027-02-18');
    expect(prochaineDate(noonUtc(2028, 1, 29), 'annuelle', 29).toISOString().slice(0, 10)).toBe('2029-02-28');
  });
});
