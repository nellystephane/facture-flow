'use strict';
const crypto = require('crypto');

function getKey() {
  const raw = process.env.EMECEF_ENCRYPTION_KEY;
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) {
    throw new Error('EMECEF_ENCRYPTION_KEY doit contenir exactement 64 caractères hexadécimaux (32 octets).');
  }
  return Buffer.from(raw, 'hex');
}

function encryptSecret(plainText) {
  if (typeof plainText !== 'string' || !plainText.trim()) throw new Error('Le jeton e-MECeF est requis.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText.trim(), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64')).join('.');
}

function decryptSecret(payload) {
  if (typeof payload !== 'string') throw new Error('Jeton e-MECeF non configuré.');
  const [iv64, tag64, data64, extra] = payload.split('.');
  if (!iv64 || !tag64 || data64 === undefined || extra !== undefined) throw new Error('Format du jeton chiffré invalide.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv64, 'base64'));
  decipher.setAuthTag(Buffer.from(tag64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data64, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encryptSecret, decryptSecret };
