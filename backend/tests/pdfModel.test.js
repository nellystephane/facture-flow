// Modèle de document PDF : indépendant de la mise en page, donc testable sans pdfkit.
const { documentModel } = require('../utils/pdfBuilder');
const { templateOf } = require('../utils/pdf/templates');

const T = templateOf('classique');
const user = { nom: 'Awa K.', entreprise: 'Atelier Awa', email: 'a@b.c', banque: { iban: 'BJ00 0000', nomBanque: 'Banque X' } };
const base = {
  numero: 'F-001', client: { nom: 'Client' }, devise: 'XOF', tva: 0, remise: 0, statut: 'envoyee',
  items: [{ description: 'Service', quantite: 2, prixUnitaire: 5000 }], dateEmission: new Date('2026-01-10'),
};

describe('documentModel', () => {
  test('facture simple : un seul total, aucune ligne de sous-total redondante', () => {
    const m = documentModel({ doc: base, user, isQuote: false, T });
    expect(m.kind).toBe('facture');
    expect(m.totals.lines).toHaveLength(0);
    expect(m.totals.total.label).toBe('Total');
    expect(m.table.rows).toHaveLength(1);
  });

  test('bouton de paiement et banque seulement si impayée', () => {
    const open = documentModel({ doc: base, user, isQuote: false, paymentUrl: 'https://pay/x', T });
    expect(open.pay).toEqual({ url: 'https://pay/x' });
    expect(open.bank.length).toBeGreaterThan(0);
    const paid = documentModel({ doc: { ...base, statut: 'payee' }, user, isQuote: false, paymentUrl: 'https://pay/x', T });
    expect(paid.pay).toBeNull();
    expect(paid.bank).toHaveLength(0);
  });

  test('plus aucun QR de paiement : seul le sceau fiscal en porte un', () => {
    const m = documentModel({ doc: base, user, isQuote: false, paymentUrl: 'https://pay/x', T });
    expect(m.seal).toBeNull();
    expect(JSON.stringify(m)).not.toMatch(/paymentQr/);
  });

  test('devis : bon pour accord, pas de bouton de paiement', () => {
    const m = documentModel({ doc: { ...base, statut: 'envoye' }, user, isQuote: true, paymentUrl: 'https://pay/x', T });
    expect(m.kind).toBe('devis');
    expect(m.accord).toBe(true);
    expect(m.pay).toBeNull();
  });

  test('TVA : ligne dédiée et total TTC', () => {
    const m = documentModel({ doc: { ...base, tva: 18 }, user, isQuote: false, T });
    expect(m.totals.total.label).toBe('Total TTC');
    expect(m.totals.lines.length).toBeGreaterThan(1);
  });

  test('devise étrangère : libellé de colonne et montants dans la devise du document', () => {
    const m = documentModel({ doc: { ...base, devise: 'EUR' }, user, isQuote: false, T });
    expect(m.devise).toBe('EUR');
    expect(m.table.columns[3].label).toMatch(/EUR|€/);
  });
});
