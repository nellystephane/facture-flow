const Invoice = require('../models/Invoice');
const User = require('../models/User');
const emecef = require('../utils/emecefService');

jest.mock('../models/Invoice', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../middleware/asyncHandler', () => (handler) => handler);
jest.mock('../utils/emecefCrypto', () => ({ encryptSecret: jest.fn((value) => `encrypted:${value}`) }));
jest.mock('../utils/emecefService', () => ({ request: jest.fn(), getOptions: jest.fn() }));

const controller = require('../controllers/fiscalisationController');

const rates = { a: 0, b: 18, c: 0, d: 18, e: 0, f: 0, aibA: 1, aibB: 5 };
const makeInvoice = (status = 'non_emise') => ({
  _id: 'invoice-1', owner: 'user-1', statut: 'brouillon', remise: 0, tva: 18,
  items: [{ description: 'Article test', quantite: 1, prixUnitaire: 1000 }],
  totalTTC: 1180, client: { nom: 'Client test' },
  fiscalisation: { status, uid: status === 'pending_confirmation' ? 'uid-test' : null },
  save: jest.fn().mockResolvedValue(undefined),
});
const makeUser = () => ({
  fiscalisation: { tokenEncrypted: 'encrypted-token', tokenConfigured: true, ifu: '0202689292011', operatorName: 'Opérateur test' },
  save: jest.fn().mockResolvedValue(undefined),
});
const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
};
const setupUserLookup = (user) => User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
const setupInvoiceLookup = (invoice) => Invoice.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(invoice) });

beforeEach(() => {
  jest.clearAllMocks();
  emecef.getOptions.mockResolvedValue({
    status: { status: true, ifu: '0202689292011', nim: 'XX01000001' },
    taxGroups: rates,
    invoiceTypes: ['FV', 'FA', 'EV', 'EA'],
    paymentTypes: ['ESPECES', 'CHEQUES', 'MOBILEMONEY', 'CARTEBANCAIRE', 'VIREMENT', 'CREDIT', 'AUTRE'],
  });
});


test('refuse un type de facture que la DGI ne propose pas pour le compte configuré', async () => {
  const invoice = makeInvoice();
  setupInvoiceLookup(invoice);
  setupUserLookup(makeUser());
  emecef.getOptions.mockResolvedValueOnce({
    status: { status: true, ifu: '0202689292011' },
    taxGroups: rates,
    invoiceTypes: [{ type: 'FV', description: 'Facture de vente' }],
    paymentTypes: [{ type: 'ESPECES', description: 'Espèces' }],
  });
  const res = makeRes();
  await controller.prepareInvoice({
    params: { id: 'invoice-1' }, userId: 'user-1',
    body: { taxGroup: 'B', paymentType: 'ESPECES', priceBasis: 'HT', invoiceType: 'EA' },
  }, res);
  expect(res.statusCode).toBe(400);
  expect(res.body.message).toMatch(/n’est pas proposé par la DGI/);
  expect(Invoice.findOneAndUpdate).not.toHaveBeenCalled();
  expect(emecef.request).not.toHaveBeenCalled();
});

test('refuse une configuration dont l’IFU DGI ne correspond pas à Oryxa', async () => {
  const invoice = makeInvoice();
  setupInvoiceLookup(invoice);
  setupUserLookup(makeUser());
  emecef.getOptions.mockResolvedValueOnce({
    status: { status: true, ifu: '0101010101010' },
    taxGroups: rates,
    invoiceTypes: [{ type: 'FV' }],
    paymentTypes: [{ type: 'ESPECES' }],
  });
  const res = makeRes();
  await controller.prepareInvoice({
    params: { id: 'invoice-1' }, userId: 'user-1',
    body: { taxGroup: 'B', paymentType: 'ESPECES', priceBasis: 'HT' },
  }, res);
  expect(res.statusCode).toBe(409);
  expect(res.body.message).toMatch(/IFU retourné par la DGI/);
  expect(Invoice.findOneAndUpdate).not.toHaveBeenCalled();
});

test('ne permet la confirmation que si le total DGI correspond au total Oryxa', async () => {
  const invoice = makeInvoice();
  const user = makeUser();
  setupInvoiceLookup(invoice);
  setupUserLookup(user);
  Invoice.findOneAndUpdate.mockResolvedValue(invoice);
  emecef.request
    .mockResolvedValueOnce({ ok: true, httpStatus: 200, data: { uid: 'uid-test', total: 1180 } });
  const res = makeRes();

  await controller.prepareInvoice({ params: { id: 'invoice-1' }, userId: 'user-1', body: { taxGroup: 'B', paymentType: 'ESPECES', priceBasis: 'HT' } }, res);

  expect(res.statusCode).toBe(200);
  expect(res.body.status).toBe('pending_confirmation');
  expect(invoice.fiscalisation.expectedTotal).toBe(1180);
  expect(invoice.fiscalisation.dgiTotal).toBe(1180);
  expect(invoice.fiscalisation.uid).toBe('uid-test');
  expect(emecef.request).toHaveBeenCalledTimes(2);
});

test('annule automatiquement la demande si le total DGI diffère', async () => {
  const invoice = makeInvoice();
  const user = makeUser();
  setupInvoiceLookup(invoice);
  setupUserLookup(user);
  Invoice.findOneAndUpdate.mockResolvedValue(invoice);
  emecef.request
    .mockResolvedValueOnce({ ok: true, httpStatus: 200, data: { uid: 'uid-test', total: 1190 } })
    .mockResolvedValueOnce({ ok: true, httpStatus: 200, data: {} });
  const res = makeRes();

  await controller.prepareInvoice({ params: { id: 'invoice-1' }, userId: 'user-1', body: { taxGroup: 'B', paymentType: 'ESPECES', priceBasis: 'HT' } }, res);

  expect(res.statusCode).toBe(422);
  expect(res.body.status).toBe('cancelled');
  expect(res.body.doNotRetry).toBe(true);
  expect(invoice.fiscalisation.status).toBe('cancelled');
  expect(invoice.fiscalisation.dgiTotal).toBe(1190);
  expect(emecef.request).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'PUT', path: '/api/invoice/uid-test/annuler' }));
});

test('marque unknown si le total diffère et que l’annulation ne peut pas être confirmée', async () => {
  const invoice = makeInvoice();
  const user = makeUser();
  setupInvoiceLookup(invoice);
  setupUserLookup(user);
  Invoice.findOneAndUpdate.mockResolvedValue(invoice);
  emecef.request
    .mockResolvedValueOnce({ ok: true, httpStatus: 200, data: { uid: 'uid-test', total: 1190 } })
    .mockRejectedValueOnce(new Error('connexion coupée'));
  const res = makeRes();

  await controller.prepareInvoice({ params: { id: 'invoice-1' }, userId: 'user-1', body: { taxGroup: 'B', paymentType: 'ESPECES', priceBasis: 'HT' } }, res);

  expect(res.statusCode).toBe(502);
  expect(res.body.status).toBe('unknown');
  expect(res.body.doNotRetry).toBe(true);
  expect(invoice.fiscalisation.status).toBe('unknown');
});

test('un timeout pendant la création interdit une nouvelle soumission automatique', async () => {
  const invoice = makeInvoice();
  const user = makeUser();
  setupInvoiceLookup(invoice);
  setupUserLookup(user);
  Invoice.findOneAndUpdate.mockResolvedValue(invoice);
  emecef.request
    .mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'EMECEF_TIMEOUT' }));
  const res = makeRes();

  await controller.prepareInvoice({ params: { id: 'invoice-1' }, userId: 'user-1', body: { taxGroup: 'B', paymentType: 'ESPECES', priceBasis: 'HT' } }, res);

  expect(res.statusCode).toBe(502);
  expect(res.body.status).toBe('unknown');
  expect(res.body.doNotRetry).toBe(true);
  expect(invoice.fiscalisation.uid).toBeNull();
});

test('rétablit pending_confirmation quand l’UID apparaît encore dans la liste DGI', async () => {
  const invoice = makeInvoice('unknown');
  invoice.fiscalisation.uid = 'uid-test';
  Invoice.findOne.mockResolvedValue(invoice);
  setupUserLookup(makeUser());
  emecef.request.mockResolvedValue({ ok: true, httpStatus: 200, data: { status: true, pendingRequestsList: [{ uid: 'uid-test' }] } });
  const res = makeRes();

  await controller.refreshInvoiceStatus({ params: { id: 'invoice-1' }, userId: 'user-1' }, res);

  expect(res.statusCode).toBe(200);
  expect(res.body.status).toBe('pending_confirmation');
  expect(res.body.pendingOnDgi).toBe(true);
  expect(invoice.fiscalisation.status).toBe('pending_confirmation');
});

test('ne prétend pas connaître le résultat si l’UID a disparu de la liste DGI', async () => {
  const invoice = makeInvoice('pending_confirmation');
  invoice.fiscalisation.uid = 'uid-test';
  Invoice.findOne.mockResolvedValue(invoice);
  setupUserLookup(makeUser());
  emecef.request.mockResolvedValue({ ok: true, httpStatus: 200, data: { status: true, pendingRequestsList: [] } });
  const res = makeRes();

  await controller.refreshInvoiceStatus({ params: { id: 'invoice-1' }, userId: 'user-1' }, res);

  expect(res.statusCode).toBe(200);
  expect(res.body.status).toBe('unknown');
  expect(res.body.pendingOnDgi).toBe(false);
  expect(invoice.fiscalisation.status).toBe('unknown');
  expect(invoice.fiscalisation.errorCode).toBe('NOT_IN_PENDING_LIST');
});

test('traite une réponse de création sans total comme ambiguë et tente de l’annuler', async () => {
  const invoice = makeInvoice();
  const user = makeUser();
  setupInvoiceLookup(invoice);
  setupUserLookup(user);
  Invoice.findOneAndUpdate.mockResolvedValue(invoice);
  emecef.request
    .mockResolvedValueOnce({ ok: true, httpStatus: 200, data: { uid: 'uid-test' } })
    .mockResolvedValueOnce({ ok: true, httpStatus: 200, data: {} });
  const res = makeRes();

  await controller.prepareInvoice({ params: { id: 'invoice-1' }, userId: 'user-1', body: { taxGroup: 'B', paymentType: 'ESPECES', priceBasis: 'HT' } }, res);

  expect(res.statusCode).toBe(422);
  expect(res.body.status).toBe('cancelled');
  expect(invoice.fiscalisation.dgiTotal).toBeNull();
  expect(emecef.request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/api/invoice/uid-test/annuler' }));
});

test('confirme une demande en attente et enregistre les éléments de sécurité DGI', async () => {
  const invoice = makeInvoice('pending_confirmation');
  invoice.fiscalisation.uid = 'uid-test';
  Invoice.findOne.mockResolvedValue(invoice);
  Invoice.findOneAndUpdate.mockResolvedValue(invoice);
  setupUserLookup(makeUser());
  emecef.request.mockResolvedValue({ ok: true, httpStatus: 200, data: { codeMECeFDGI: 'ABCD-EFGH-IJKL-MNOP-QRST-UVWX', nim: 'XX01000001', dateTime: '29/10/2026 12:00:00', qrCode: 'qr-data', counters: '1/1 FV' } });
  const res = makeRes();

  await controller.confirmInvoice({ params: { id: 'invoice-1' }, userId: 'user-1' }, res);

  expect(res.statusCode).toBe(200);
  expect(res.body.status).toBe('confirmed');
  expect(invoice.fiscalisation.status).toBe('confirmed');
  expect(invoice.fiscalisation.codeMECeFDGI).toBe('ABCD-EFGH-IJKL-MNOP-QRST-UVWX');
  expect(emecef.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT', path: '/api/invoice/uid-test/confirm' }));
});

test('le code DGI 20 à la confirmation passe en unknown sans nouvelle tentative', async () => {
  const invoice = makeInvoice('pending_confirmation');
  invoice.fiscalisation.uid = 'uid-test';
  Invoice.findOne.mockResolvedValue(invoice);
  Invoice.findOneAndUpdate.mockResolvedValue(invoice);
  setupUserLookup(makeUser());
  emecef.request.mockResolvedValue({ ok: true, httpStatus: 200, data: { errorCode: '20', errorDesc: 'Déjà finalisée ou annulée' } });
  const res = makeRes();

  await controller.confirmInvoice({ params: { id: 'invoice-1' }, userId: 'user-1' }, res);

  expect(res.statusCode).toBe(422);
  expect(res.body.status).toBe('unknown');
  expect(res.body.doNotRetry).toBe(true);
  expect(invoice.fiscalisation.status).toBe('unknown');
});

test('annule une demande en attente avec la route documentée par la DGI', async () => {
  const invoice = makeInvoice('pending_confirmation');
  invoice.fiscalisation.uid = 'uid-test';
  Invoice.findOne.mockResolvedValue(invoice);
  Invoice.findOneAndUpdate.mockResolvedValue(invoice);
  setupUserLookup(makeUser());
  emecef.request.mockResolvedValue({ ok: true, httpStatus: 200, data: {} });
  const res = makeRes();

  await controller.cancelInvoice({ params: { id: 'invoice-1' }, userId: 'user-1' }, res);

  expect(res.statusCode).toBe(200);
  expect(res.body.status).toBe('cancelled');
  expect(emecef.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT', path: '/api/invoice/uid-test/annuler' }));
});

test('bloque une seconde opération si le verrou atomique est déjà pris', async () => {
  const invoice = makeInvoice('pending_confirmation');
  invoice.fiscalisation.uid = 'uid-test';
  Invoice.findOne.mockResolvedValue(invoice);
  Invoice.findOneAndUpdate.mockResolvedValue(null);
  setupUserLookup(makeUser());
  const res = makeRes();

  await controller.confirmInvoice({ params: { id: 'invoice-1' }, userId: 'user-1' }, res);

  expect(res.statusCode).toBe(409);
  expect(emecef.request).not.toHaveBeenCalled();
});
