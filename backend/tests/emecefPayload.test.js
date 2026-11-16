const { _buildPayloadForTests: buildPayload } = require('../controllers/fiscalisationController');

const base = () => ({
  invoice: {
    statut: 'brouillon', remise: 0, tva: 18,
    items: [{ description: 'Article test', quantite: 1, prixUnitaire: 1000 }],
    totalTTC: 1180,
  },
  client: { nom: 'Client test', telephone: '97000000' },
  config: { ifu: '0202689292011', operatorName: 'Opérateur test' },
  taxGroup: 'B', paymentType: 'ESPECES', priceBasis: 'HT',
  taxGroupRates: { a: 0, b: 18, c: 0, d: 18, e: 0, f: 0, aibA: 1, aibB: 5 },
});

test('prépare une facture de vente simple avec prix TTC transmis à la DGI', () => {
  const result = buildPayload(base());
  expect(result.expectedTotal).toBe(1180);
  expect(result.payload.ifu).toBe('0202689292011');
  expect(result.payload.type).toBe('FV');
  expect(result.payload.items[0]).toEqual({ name: 'Article test', price: 1180, quantity: 1, taxGroup: 'B' });
  expect(result.payload.operator.name).toBe('Opérateur test');
  expect(result.payload.payment).toEqual([{ name: 'ESPECES', amount: 1180 }]);
});

test('bloque les remises globales non prises en charge', () => {
  const input = base(); input.invoice.remise = 100;
  expect(() => buildPayload(input)).toThrow(/remise globale/);
});

test('bloque un total commercial incompatible avec le groupe fiscal choisi', () => {
  const input = base(); input.invoice.tva = 5; input.invoice.totalTTC = 1050;
  expect(() => buildPayload(input)).toThrow(/ne correspond pas au total Oryxa/);
});

test('bloque un IFU vendeur mal formé', () => {
  const input = base(); input.config.ifu = '123';
  expect(() => buildPayload(input)).toThrow(/13 chiffres/);
});

test('accepte le mode de paiement CREDIT documenté par la DGI', () => {
  const input = base(); input.paymentType = 'CREDIT';
  const result = buildPayload(input);
  expect(result.payload.payment).toEqual([{ name: 'CREDIT', amount: 1180 }]);
});

test('refuse la base TTC tant que le modèle Oryxa calcule la TVA sur les prix saisis', () => {
  const input = base(); input.priceBasis = 'TTC';
  expect(() => buildPayload(input)).toThrow(/mode TTC n’est pas pris en charge/);
});

test('refuse une quantité nulle ou négative', () => {
  const input = base(); input.invoice.items[0].quantite = 0;
  expect(() => buildPayload(input)).toThrow(/quantité.*invalide/);
});

test('refuse un article sans libellé', () => {
  const input = base(); input.invoice.items[0].description = '   ';
  expect(() => buildPayload(input)).toThrow(/n’a pas de libellé/);
});

test('bloque les totaux Oryxa/DGI incompatibles avant tout appel de création', () => {
  const input = base(); input.invoice.totalTTC = 1250;
  expect(() => buildPayload(input)).toThrow(/ne correspond pas au total Oryxa/);
});


test('prépare une facture de vente à l’exportation', () => {
  const input = base(); input.invoiceType = 'EV';
  const result = buildPayload(input);
  expect(result.payload.type).toBe('EV');
  expect(result.payload.reference).toBeUndefined();
});

test('refuse un avoir sans référence MECeF/DGI originale', () => {
  const input = base(); input.invoiceType = 'FA';
  expect(() => buildPayload(input)).toThrow(/référence.*24 caractères/);
});

test('prépare un avoir avec référence normalisée et AIB', () => {
  const input = base(); input.invoiceType = 'FA'; input.reference = 'ABCDABCDABCDABCDABCDABCD'; input.aib = 'A';
  const result = buildPayload(input);
  expect(result.payload.type).toBe('FA');
  expect(result.payload.reference).toBe('ABCDABCDABCDABCDABCDABCD');
  expect(result.payload.aib).toBe('A');
});

test('inclut une taxe spécifique au niveau de la ligne et dans le total attendu', () => {
  const input = base(); input.invoice.items[0].taxSpecific = 50; input.invoice.totalTTC = 1230;
  const result = buildPayload(input);
  expect(result.payload.items[0].taxSpecific).toBe(50);
  expect(result.expectedTotal).toBe(1230);
});

test('refuse un type de facture inconnu', () => {
  const input = base(); input.invoiceType = 'XX';
  expect(() => buildPayload(input)).toThrow(/type de facture reconnu/);
});

test('calcule un total de référence distinct pour des lignes exonérées et taxables', () => {
  const input = base();
  input.invoice.items.push({ description: 'Article exonéré', quantite: 1, prixUnitaire: 1000, taxGroup: 'A' });
  input.invoice.totalTTC = 2180;
  const result = buildPayload(input);
  expect(result.payload.items.map((item) => item.taxGroup)).toEqual(['B', 'A']);
  expect(result.expectedTotal).toBe(2180);
});

test('transmet une taxe spécifique et un groupe fiscal explicite par ligne', () => {
  const input = base();
  input.invoice.items[0].taxGroup = 'A';
  input.invoice.items[0].taxSpecific = 75;
  input.invoice.totalTTC = 1075;
  const result = buildPayload(input);
  expect(result.payload.items[0]).toMatchObject({ taxGroup: 'A', price: 1000, taxSpecific: 75 });
  expect(result.expectedTotal).toBe(1075);
});

test('bloque un groupe fiscal mixte si le total commercial ne correspond pas au total fiscal par ligne', () => {
  const input = base();
  input.invoice.items.push({ description: 'Article exonéré', quantite: 1, prixUnitaire: 1000, taxGroup: 'A' });
  expect(() => buildPayload(input)).toThrow(/ne correspond pas au total TTC Oryxa/);
});

test('bloque une taxe spécifique si elle crée un écart avec le total commercial', () => {
  const input = base();
  input.invoice.items[0].taxSpecific = 50;
  expect(() => buildPayload(input)).toThrow(/ne correspond pas au total TTC Oryxa/);
});

test('exige une justification lorsqu’un prix d’origine est transmis', () => {
  const input = base();
  input.invoice.items[0].originalPrice = 1200;
  expect(() => buildPayload(input)).toThrow(/justification de modification/);
});
