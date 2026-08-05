const crypto = require('crypto');

// ============================================================================
// Intégration FedaPay — passerelle de paiement (Mobile Money MTN/Moov, carte
// bancaire, virement) pour le marché béninois.
// Créez un compte sur https://fedapay.com, récupérez vos clés API (sandbox
// puis live) et renseignez dans backend/.env :
//   FEDAPAY_SECRET_KEY=sk_sandbox_xxx   (ou sk_live_xxx en production)
//   FEDAPAY_ENVIRONMENT=sandbox         (ou "live")
//   FEDAPAY_WEBHOOK_SECRET=wh_xxx       (Paramètres > Webhooks côté FedaPay)
// Documentation officielle : https://docs.fedapay.com
// ============================================================================

function isFedapayConfigured() {
  return !!process.env.FEDAPAY_SECRET_KEY;
}

function apiBase() {
  const env = process.env.FEDAPAY_ENVIRONMENT === 'live' ? 'live' : 'sandbox';
  return env === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
}

async function fedapayFetch(path, options = {}) {
  if (!isFedapayConfigured()) {
    const err = new Error("FedaPay n'est pas configuré côté serveur (FEDAPAY_SECRET_KEY manquant).");
    err.code = 'FEDAPAY_NOT_CONFIGURED';
    throw err;
  }
  const res = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || `Erreur FedaPay (HTTP ${res.status})`);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

/**
 * Crée une transaction FedaPay puis génère le lien de paiement hébergé
 * (Checkout FedaPay) où le client choisit lui-même son moyen de paiement :
 * Mobile Money (MTN/Moov), carte bancaire, ou virement.
 *
 * @param {object} params
 * @param {number} params.amount - Montant en FCFA (entier)
 * @param {string} params.description
 * @param {{email:string, firstname?:string, lastname?:string, phone?:string}} params.customer
 * @param {string} params.callbackUrl - URL de retour après paiement
 * @param {object} params.metadata - Données libres (ex: { invoiceId, type: 'facture' })
 * @returns {Promise<{transactionId:number, paymentUrl:string, token:string}>}
 */
async function createPaymentLink({ amount, description, customer, callbackUrl, metadata }) {
  const created = await fedapayFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      description,
      amount: Math.round(amount),
      currency: { iso: 'XOF' },
      callback_url: callbackUrl,
      customer: {
        email: customer.email,
        firstname: customer.firstname || customer.email.split('@')[0],
        lastname: customer.lastname || '.',
        phone_number: customer.phone ? { number: customer.phone, country: 'bj' } : undefined,
      },
      custom_metadata: metadata || {},
    }),
  });

  const transaction = created['v1/transaction'] || created.transaction || created;
  const transactionId = transaction.id;

  const tokenRes = await fedapayFetch(`/transactions/${transactionId}/token`, { method: 'POST' });
  const tokenData = tokenRes['v1/token'] || tokenRes.token || tokenRes;

  return {
    transactionId,
    paymentUrl: tokenData.url,
    token: tokenData.token,
  };
}

async function getTransaction(transactionId) {
  const data = await fedapayFetch(`/transactions/${transactionId}`, { method: 'GET' });
  return data['v1/transaction'] || data.transaction || data;
}

/**
 * Vérifie la signature d'un webhook FedaPay (en-tête X-FEDAPAY-SIGNATURE).
 * @param {Buffer|string} rawBody - Corps BRUT de la requête (avant JSON.parse)
 * @param {string} signatureHeader
 * @param {string} secret - FEDAPAY_WEBHOOK_SECRET
 */
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  // Format d'en-tête FedaPay : "t=timestamp,s=signature"
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('=').map((s) => s.trim()))
  );
  if (!parts.t || !parts.s) return false;
  const payload = `${parts.t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.s));
  } catch {
    return false;
  }
}

module.exports = {
  isFedapayConfigured,
  createPaymentLink,
  getTransaction,
  verifyWebhookSignature,
};
