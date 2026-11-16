const crypto = require('crypto');
const { encryptSecret, decryptSecret } = require('../utils/emecefCrypto');

beforeEach(() => {
  process.env.EMECEF_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
});

afterEach(() => { delete process.env.EMECEF_ENCRYPTION_KEY; });

test('chiffre et déchiffre le jeton sans le stocker en clair', () => {
  const token = 'test-token-not-real-0123456789';
  const encrypted = encryptSecret(token);
  expect(encrypted).not.toContain(token);
  expect(decryptSecret(encrypted)).toBe(token);
});

test('refuse une clé de chiffrement absente ou invalide', () => {
  process.env.EMECEF_ENCRYPTION_KEY = 'short';
  expect(() => encryptSecret('test-token-0123456789')).toThrow(/64 caractères hexadécimaux/);
});

test('refuse un jeton chiffré altéré', () => {
  const encrypted = encryptSecret('test-token-not-real-0123456789');
  const [iv, tag, data] = encrypted.split('.');
  const tampered = `${iv}.${tag}.${Buffer.from(data, 'base64').toString('base64').slice(0, -2)}AA`;
  expect(() => decryptSecret(tampered)).toThrow();
});
