const crypto = require('crypto');
const { encryptSecret } = require('../utils/emecefCrypto');
const { request, getBaseUrl } = require('../utils/emecefService');

const originalFetch = global.fetch;
beforeEach(() => { process.env.EMECEF_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex'); delete process.env.EMECEF_TEST_BASE_URL; });
afterEach(() => { delete process.env.EMECEF_ENCRYPTION_KEY; delete process.env.EMECEF_TEST_BASE_URL; global.fetch = originalFetch; jest.restoreAllMocks(); });

test('force la base de test et refuse la production', () => {
  expect(getBaseUrl('test')).toBe('https://developper.impots.bj/sygmef-emcf');
  expect(() => getBaseUrl('production')).toThrow(/production e-MECeF n’est pas activée/);
  process.env.EMECEF_TEST_BASE_URL = 'https://sygmef.impots.bj/emcf';
  expect(() => getBaseUrl('test')).toThrow(/verrouillé sur/);
  process.env.EMECEF_TEST_BASE_URL = 'https://developper.impots.bj:8443/sygmef-emcf';
  expect(() => getBaseUrl('test')).toThrow(/verrouillé sur/);
  process.env.EMECEF_TEST_BASE_URL = 'https://developper.impots.bj/sygmef-emcf?next=evil';
  expect(() => getBaseUrl('test')).toThrow(/verrouillé sur/);
});

test('envoie le jeton uniquement dans l’en-tête Bearer', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ status: true }) });
  const tokenEncrypted = encryptSecret('fake-test-token-0123456789');
  const result = await request({ tokenEncrypted, path: '/api/info/status' });
  expect(result.data.status).toBe(true);
  expect(global.fetch).toHaveBeenCalledWith(
    'https://developper.impots.bj/sygmef-emcf/api/info/status',
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fake-test-token-0123456789' }) })
  );
});

test('refuse les chemins hors API et les tentatives de traversal', async () => {
  const tokenEncrypted = encryptSecret('fake-test-token-0123456789');
  await expect(request({ tokenEncrypted, path: 'https://evil.invalid' })).rejects.toThrow(/Chemin API/);
  await expect(request({ tokenEncrypted, path: '/api/../admin' })).rejects.toThrow(/Chemin API/);
  await expect(request({ tokenEncrypted, path: '/api/info/status?redirect=evil' })).rejects.toThrow(/Chemin API/);
});

test('convertit un délai dépassé en erreur explicite et ne masque pas l’incertitude', async () => {
  global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  const tokenEncrypted = encryptSecret('fake-test-token-0123456789');
  await expect(request({ tokenEncrypted, path: '/api/info/status' })).rejects.toMatchObject({ code: 'EMECEF_TIMEOUT' });
});

test('retourne un corps JSON valide même si le statut HTTP est une erreur', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => JSON.stringify({ errorCode: '401', errorDesc: 'Jeton invalide' }) });
  const tokenEncrypted = encryptSecret('fake-test-token-0123456789');
  await expect(request({ tokenEncrypted, path: '/api/info/status' })).resolves.toMatchObject({ httpStatus: 401, ok: false, data: { errorCode: '401' } });
});

test('valide la structure des quatre réponses de configuration DGI', async () => {
  const status = { status: true, version: '1.0' };
  const taxGroups = { a: 0, b: 18, c: 0, d: 18, e: 0, f: 0, aibA: 1, aibB: 5 };
  const invoiceTypes = [{ type: 'FV', description: 'Facture de vente' }];
  const paymentTypes = [{ type: 'ESPECES', description: 'ESPECES' }];
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(status) })
    .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(taxGroups) })
    .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(invoiceTypes) })
    .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify(paymentTypes) });
  const { getOptions } = require('../utils/emecefService');
  const tokenEncrypted = encryptSecret('fake-test-token-0123456789');
  await expect(getOptions({ tokenEncrypted })).resolves.toEqual({ status, taxGroups, invoiceTypes, paymentTypes });
});

test('refuse une configuration DGI incomplète même avec HTTP 200', async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ status: true }) })
    .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ b: 18 }) })
    .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) })
    .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([]) });
  const { getOptions } = require('../utils/emecefService');
  const tokenEncrypted = encryptSecret('fake-test-token-0123456789');
  await expect(getOptions({ tokenEncrypted })).rejects.toThrow(/incomplète ou invalide/);
});
