const { computeInvoiceTotals, sumPaid, isFullyPaid } = require('../utils/invoiceTotals');
const { nextStatusFor } = require('../utils/invoicePayments');

describe('invoiceTotals (source unique des montants)', () => {
  const base = { items: [{ quantite: 3, prixUnitaire: 3333, taxSpecific: 100 }], remise: 0, tva: 18 };

  test('inclut la taxe spécifique dans le TTC', () => {
    const t = computeInvoiceTotals(base);
    expect(t.totalTTC).toBeCloseTo(11898.82, 2);
    expect(t.totalDu).toBe(11899);
  });

  test('facture normalisée mixte : A exonéré et B à 18 % sont calculés ligne par ligne', () => {
    const t = computeInvoiceTotals({
      modeFacturation: 'normalisee', remise: 0, tva: 0,
      items: [
        { description: 'Article A', quantite: 2, prixUnitaire: 1000, taxGroup: 'A', taxRate: 0, taxSpecific: 0 },
        { description: 'Article B', quantite: 3, prixUnitaire: 1000, taxGroup: 'B', taxRate: 18, taxSpecific: 0 },
      ],
    });
    expect(t.totalTTC).toBe(5540);
    expect(t.montantTva).toBe(540);
  });

  test('la taxe spécifique est ajoutée séparément de la TVA', () => {
    const t = computeInvoiceTotals({
      modeFacturation: 'normalisee', remise: 0, tva: 0,
      items: [{ quantite: 3, prixUnitaire: 1000, taxGroup: 'B', taxRate: 18, taxSpecific: 120 }],
    });
    expect(t.totalTTC).toBe(3660);
    expect(t.taxSpecific).toBe(120);
  });

  test('les factures commerciales conservent le calcul global historique', () => {
    const t = computeInvoiceTotals({
      modeFacturation: 'commerciale', remise: 0, tva: 18,
      items: [{ quantite: 3, prixUnitaire: 1000, taxRate: 18, taxSpecific: 0 }],
    });
    expect(t.totalTTC).toBe(3540);
  });

  test('le total DGI confirmé fait foi', () => {
    const t = computeInvoiceTotals({ ...base, fiscalisation: { status: 'confirmed', dgiTotal: 11900 } });
    expect(t.totalTTC).toBe(11900);
    expect(t.totalDu).toBe(11900);
  });

  test('un total DGI non confirmé est ignoré', () => {
    const t = computeInvoiceTotals({ ...base, fiscalisation: { status: 'pending_confirmation', dgiTotal: 11900 } });
    expect(t.totalDu).toBe(11899);
  });

  test('sumPaid ignore les paiements remboursés ou non confirmés et utilise montantFacture', () => {
    const total = sumPaid([
      { statut: 'complete', montant: 1050, montantFacture: 1000 },
      { statut: 'complete', montant: 500, rembourse: true },
      { statut: 'en_attente', montant: 300 },
      { statut: 'complete', montant: 200 },
    ]);
    expect(total).toBe(1200);
  });

  test('isFullyPaid', () => {
    expect(isFullyPaid(1000, 1000)).toBe(true);
    expect(isFullyPaid(999, 1000)).toBe(false);
    expect(isFullyPaid(0, 0)).toBe(false);
  });
});

describe('nextStatusFor', () => {
  test('payée quand tout est réglé, jamais pour une facture annulée', () => {
    expect(nextStatusFor('envoyee', { estPayee: true, totalPaye: 10 })).toBe('payee');
    expect(nextStatusFor('annulee', { estPayee: true, totalPaye: 10 })).toBe('annulee');
  });
  test('retombe à envoyée si un paiement est remboursé', () => {
    expect(nextStatusFor('payee', { estPayee: false, totalPaye: 0 })).toBe('envoyee');
  });
  test('un brouillon avec paiement devient envoyée', () => {
    expect(nextStatusFor('brouillon', { estPayee: false, totalPaye: 5 })).toBe('envoyee');
  });
});
