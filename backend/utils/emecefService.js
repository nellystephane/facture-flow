'use strict';
const { decryptSecret } = require('./emecefCrypto');

const TEST_BASE_URL = 'https://developper.impots.bj/sygmef-emcf';
const PRODUCTION_BASE_URL = 'https://sygmef.impots.bj/emcf';
const REQUEST_TIMEOUT_MS = 15000;

function getBaseUrl(environment) {
  if (environment !== 'test') throw new Error('La production e-MECeF n’est pas activée dans cette version de test.');
  const configured = (process.env.EMECEF_TEST_BASE_URL || TEST_BASE_URL).replace(/\/$/, '');
  let parsed;
  try { parsed = new URL(configured); } catch { throw new Error('EMECEF_TEST_BASE_URL n’est pas une URL valide.'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'developper.impots.bj' ||
      parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash ||
      parsed.pathname.replace(/\/$/, '') !== '/sygmef-emcf') {
    throw new Error('L’environnement de test est verrouillé sur https://developper.impots.bj/sygmef-emcf. Une autre adresse est refusée.');
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
}

async function request({ environment = 'test', tokenEncrypted, method = 'GET', path, body }) {
  if (typeof path !== 'string' || !/^\/api(?:\/[A-Za-z0-9_-]+)*$/.test(path)) throw new Error('Chemin API e-MECeF invalide.');
  if (!['GET', 'POST', 'PUT'].includes(method)) throw new Error('Méthode HTTP e-MECeF invalide.');
  const token = decryptSecret(tokenEncrypted);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${getBaseUrl(environment)}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: 'Réponse non JSON reçue de la DGI.' }; }
    return { httpStatus: response.status, ok: response.ok, data };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Délai dépassé lors de l’appel à la DGI. Le résultat est incertain : ne renvoyez pas la facture automatiquement.');
      timeoutError.code = 'EMECEF_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getOptions(config) {
  const [status, taxGroups, invoiceTypes, paymentTypes] = await Promise.all([
    request({ ...config, path: '/api/info/status' }),
    request({ ...config, path: '/api/info/taxGroups' }),
    request({ ...config, path: '/api/info/invoiceTypes' }),
    request({ ...config, path: '/api/info/paymentTypes' }),
  ]);
  for (const result of [status, taxGroups, invoiceTypes, paymentTypes]) {
    if (!result.ok || result.data?.status === false || result.data?.errorCode) {
      const err = new Error(result.data?.errorDesc || result.data?.message || 'La DGI a refusé une requête de configuration.');
      err.status = result.httpStatus || 502;
      err.details = result.data;
      throw err;
    }
  }
  const taxKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'aibA', 'aibB'];
  if (!status.data || status.data.status !== true ||
      !taxGroups.data || !taxKeys.every((key) => taxGroups.data[key] !== null && taxGroups.data[key] !== undefined && Number.isFinite(Number(taxGroups.data[key]))) ||
      !Array.isArray(invoiceTypes.data) || invoiceTypes.data.length === 0 || !Array.isArray(paymentTypes.data) || paymentTypes.data.length === 0) {
    const err = new Error('La DGI a renvoyé une réponse de configuration incomplète ou invalide.');
    err.status = 502;
    throw err;
  }
  return { status: status.data, taxGroups: taxGroups.data, invoiceTypes: invoiceTypes.data, paymentTypes: paymentTypes.data };
}

module.exports = { request, getOptions, getBaseUrl, TEST_BASE_URL, PRODUCTION_BASE_URL };
