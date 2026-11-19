const c = require('../utils/currency');
const { computeInvoiceTotals, paidAmountXOF } = require('../utils/invoiceTotals');
const { summarizeClient } = require('../utils/clientHistory');

describe('devises', () => {
  test('normalise les anciennes valeurs', () => {
    expect(c.normalizeDevise('FCFA')).toBe('XOF');
    expect(c.normalizeDevise('F CFA')).toBe('XOF');
    expect(c.normalizeDevise(undefined)).toBe('XOF');
    expect(c.normalizeDevise('eur')).toBe('EUR');
    expect(c.normalizeDevise('ZZZ')).toBe('XOF');
  });
  test('arrondi selon la devise', () => {
    expect(c.roundMoney(1234.5678, 'XOF')).toBe(1235);
    expect(c.roundMoney(10.005, 'EUR')).toBeCloseTo(10.01, 2);
    expect(c.roundMoney(10.004, 'EUR')).toBe(10);
  });
  test('affichage', () => {
    expect(c.formatMoney(1234567, 'XOF')).toBe('1 234 567 FCFA');
    expect(c.formatMoney(1234.5, 'EUR')).toBe('1 234,50 €');
    expect(c.formatMoney(-5, 'USD')).toBe('-5,00 $');
  });
  test('taux', () => {
    expect(c.resolveRate('XOF', null)).toBe(1);
    expect(c.resolveRate('EUR', 655.957)).toBe(655.957);
    expect(c.resolveRate('EUR', 0)).toBeNull();
    expect(c.toXOF(100, 'EUR', 655.957)).toBe(65596);
  });
  test('resolveDocumentCurrency : création', () => {
    expect(c.resolveDocumentCurrency({}, 'FCFA').fields).toEqual({ devise: 'XOF', tauxChange: 1 });
    expect(c.resolveDocumentCurrency({ devise: 'EUR' }, 'XOF').error).toMatch(/taux/i);
    expect(c.resolveDocumentCurrency({ devise: 'EUR', tauxChange: 656 }, 'XOF').fields).toEqual({ devise: 'EUR', tauxChange: 656 });
    expect(c.resolveDocumentCurrency({ devise: 'XYZ' }, 'XOF').error).toMatch(/devise/i);
  });
  test('resolveDocumentCurrency : modification', () => {
    const ex = { devise: 'EUR', tauxChange: 656 };
    expect(c.resolveDocumentCurrency({}, null, ex).fields).toEqual({});
    expect(c.resolveDocumentCurrency({ tauxChange: 660 }, null, ex).fields).toEqual({ devise: 'EUR', tauxChange: 660 });
    expect(c.resolveDocumentCurrency({ devise: 'XOF' }, null, ex).fields).toEqual({ devise: 'XOF', tauxChange: 1 });
    expect(c.resolveDocumentCurrency({ devise: 'USD' }, null, ex).error).toMatch(/taux/i);
  });
});

describe('totaux par devise', () => {
  const inv = { devise: 'EUR', tauxChange: 656, tva: 0, remise: 0, items: [{ quantite: 3, prixUnitaire: 10.333 }] };
  test('arrondi à 2 décimales et équivalent XOF', () => {
    const t = computeInvoiceTotals(inv);
    expect(t.totalDu).toBe(31);
    expect(Math.round(t.totalXOF)).toBe(Math.round(30.999 * 656));
  });
  test('facture XOF inchangée', () => {
    const t = computeInvoiceTotals({ tva: 18, remise: 0, items: [{ quantite: 1, prixUnitaire: 1000 }] });
    expect(t.totalDu).toBe(1180);
    expect(t.totalXOF).toBe(1180);
  });
  test('paiement converti', () => {
    expect(paidAmountXOF({ montant: 10, devise: 'EUR', tauxChange: 656 })).toBe(6560);
    expect(paidAmountXOF({ montant: 500 })).toBe(500);
  });
  test('synthèse client en équivalent FCFA', () => {
    const r = summarizeClient({
      invoices: [
        { _id: 'a', statut: 'envoyee', dateEmission: '2026-01-01', ...inv },
        { _id: 'b', statut: 'envoyee', dateEmission: '2026-01-01', tva: 0, remise: 0, items: [{ quantite: 1, prixUnitaire: 1000 }] },
      ],
      payments: [],
      now: new Date('2026-02-01'),
    });
    expect(r.totalFacture).toBe(Math.round(31 * 656 + 1000));
    expect(r.lignes[0].devise).toBe('EUR');
  });
});
