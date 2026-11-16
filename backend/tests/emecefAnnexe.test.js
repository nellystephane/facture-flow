const { _buildPayloadForTests: buildPayload } = require('../controllers/fiscalisationController');

const rates = { a: 0, b: 18, c: 0, d: 18, e: 0, f: 0, aibA: 1, aibB: 5 };
const client = { ifu: '9999900000002', nom: 'Client test', telephone: '97000000', adresse: 'Cotonou' };
const reference = 'ABCDABCDABCDABCDABCDABCD';

function scenario({ type = 'FV', items, aib = '', withClient = false, original = false, total, taxGroup = 'B' }) {
  const invoice = {
    statut: 'brouillon', remise: 0, tva: 18, items: items.map((item, i) => ({ description: `Article ${i + 1}`, quantite: item.quantity, prixUnitaire: item.price, taxGroup: item.group, taxSpecific: item.taxSpecific || 0 })), totalTTC: total,
  };
  if (items.every((item) => ['A', 'C', 'E', 'F'].includes(item.group))) invoice.tva = 0;
  if (items.every((item) => ['A', 'C', 'E', 'F'].includes(item.group))) invoice.totalTTC = items.reduce((sum, item) => sum + Math.round(item.price * item.quantity) + (item.taxSpecific || 0), 0);
  if (items.every((item) => ['B', 'D'].includes(item.group))) invoice.totalTTC = items.reduce((sum, item) => sum + Math.round(item.price * 1.18) * item.quantity + (item.taxSpecific || 0), 0);
  const input = {
    invoice, client: withClient ? client : null,
    config: { ifu: '0202689292011', operatorName: 'Opérateur test' },
    taxGroup, paymentType: 'ESPECES', priceBasis: 'HT', taxGroupRates: rates,
    invoiceType: type, aib, reference: original ? reference : '',
  };
  return buildPayload(input);
}

test('Annexe test 1 — FV exonérée, quantité 1', () => {
  const r = scenario({ items: [{ group: 'A', quantity: 1, price: 1000 }], taxGroup: 'A', total: 1000 });
  expect(r.payload.type).toBe('FV'); expect(r.payload.items[0].taxGroup).toBe('A'); expect(r.expectedTotal).toBe(1000);
});
test('Annexe test 2 — FV taxable, quantité 1', () => {
  const r = scenario({ items: [{ group: 'B', quantity: 1, price: 1000 }], total: 1180 });
  expect(r.expectedTotal).toBe(1180);
});
test('Annexe test 3 — FV exonéré + taxable, quantités 2 et 3', () => {
  const r = scenario({ items: [{ group: 'A', quantity: 2, price: 1000 }, { group: 'B', quantity: 3, price: 1000 }], total: 5540 });
  expect(r.payload.items.map((x) => x.taxGroup)).toEqual(['A', 'B']); expect(r.expectedTotal).toBe(5540);
});
test('Annexe test 4 — FV quantités décimales 2,5 et 3,250', () => {
  const r = scenario({ items: [{ group: 'A', quantity: 2.5, price: 1000 }, { group: 'B', quantity: 3.25, price: 1000 }], total: 6335 });
  expect(r.payload.items.map((x) => x.quantity)).toEqual([2.5, 3.25]); expect(r.expectedTotal).toBe(6335);
});
test('Annexe test 5 — FV avec IFU et nom client', () => {
  const r = scenario({ items: [{ group: 'A', quantity: 2, price: 1000 }, { group: 'B', quantity: 3, price: 1000 }], withClient: true, total: 5540 });
  expect(r.payload.client).toMatchObject({ ifu: client.ifu, name: client.nom });
});
test('Annexe test 6 — FA avec référence originale', () => {
  const r = scenario({ type: 'FA', original: true, items: [{ group: 'A', quantity: 2, price: 1000 }, { group: 'B', quantity: 3, price: 1000 }], withClient: true, total: 5540 });
  expect(r.payload.type).toBe('FA'); expect(r.payload.reference).toBe(reference);
});
test('Annexe test 7 — FV taxable avec taxe spécifique', () => {
  const r = scenario({ items: [{ group: 'B', quantity: 3, price: 1000, taxSpecific: 150 }], withClient: true, total: 3690 });
  expect(r.payload.items[0].taxSpecific).toBe(150); expect(r.expectedTotal).toBe(3690);
});
test('Annexe test 8 — FV mixte avec AIB 5 %', () => {
  const r = scenario({ items: [{ group: 'A', quantity: 2, price: 1000 }, { group: 'B', quantity: 3, price: 1000 }], aib: 'B', total: 5540 });
  expect(r.payload.aib).toBe('B');
});
test('Annexe test 9 — FV mixte avec client et AIB 1 %', () => {
  const r = scenario({ items: [{ group: 'A', quantity: 2, price: 1000 }, { group: 'B', quantity: 3, price: 1000 }], aib: 'A', withClient: true, total: 5540 });
  expect(r.payload.aib).toBe('A'); expect(r.payload.client.ifu).toBe(client.ifu);
});
test('Annexe test 10 — FV mixte avec taxe spécifique et AIB 5 %', () => {
  const r = scenario({ items: [{ group: 'A', quantity: 2, price: 1000 }, { group: 'B', quantity: 3, price: 1000, taxSpecific: 150 }], aib: 'B', total: 5690 });
  expect(r.payload.aib).toBe('B'); expect(r.expectedTotal).toBe(5690);
});
test.skip('Annexe test 11 — taxe de séjour : attendre la clarification du champ API auprès de la DGI');
test('Annexe test 12 — régime d’exception D, quantité 2', () => {
  const r = scenario({ items: [{ group: 'D', quantity: 2, price: 1000 }], taxGroup: 'D', total: 2360 }); expect(r.expectedTotal).toBe(2360);
});
test('Annexe test 13 — régime d’exception D avec taxe spécifique', () => {
  const r = scenario({ items: [{ group: 'D', quantity: 2, price: 1000, taxSpecific: 100 }], taxGroup: 'D', total: 2460 }); expect(r.expectedTotal).toBe(2460);
});
test('Annexe test 14 — régime TPS E, quantité 2', () => {
  const r = scenario({ items: [{ group: 'E', quantity: 2, price: 1000 }], taxGroup: 'E', total: 2000 }); expect(r.expectedTotal).toBe(2000);
});
test('Annexe test 15 — régime TPS E avec taxe spécifique', () => {
  const r = scenario({ items: [{ group: 'E', quantity: 2, price: 1000, taxSpecific: 100 }], taxGroup: 'E', total: 2100 }); expect(r.expectedTotal).toBe(2100);
});
test('Annexe test 16 — export EV, groupe C', () => {
  const r = scenario({ type: 'EV', items: [{ group: 'C', quantity: 2, price: 1000 }], taxGroup: 'C', total: 2000 }); expect(r.payload.type).toBe('EV'); expect(r.expectedTotal).toBe(2000);
});
test('Annexe test 17 — export EV avec groupes A et C', () => {
  const r = scenario({ type: 'EV', items: [{ group: 'A', quantity: 2, price: 1000 }, { group: 'C', quantity: 3, price: 1000 }], taxGroup: 'C', total: 5000 }); expect(r.payload.items.map((x) => x.taxGroup)).toEqual(['A', 'C']);
});
test('Annexe test 18 — avoir export EA avec référence et groupe C', () => {
  const r = scenario({ type: 'EA', original: true, items: [{ group: 'C', quantity: 2, price: 1000 }], taxGroup: 'C', total: 2000 }); expect(r.payload.type).toBe('EA'); expect(r.payload.reference).toBe(reference);
});
test('Annexe test 19 — export EV, groupe TPS E', () => {
  const r = scenario({ type: 'EV', items: [{ group: 'E', quantity: 2, price: 1000 }], taxGroup: 'E', total: 2000 }); expect(r.payload.type).toBe('EV'); expect(r.expectedTotal).toBe(2000);
});
test('Annexe test 20 — avoir export EA, groupe TPS E', () => {
  const r = scenario({ type: 'EA', original: true, items: [{ group: 'E', quantity: 2, price: 1000 }], taxGroup: 'E', total: 2000 }); expect(r.payload.type).toBe('EA'); expect(r.payload.reference).toBe(reference);
});
