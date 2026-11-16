const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const fedapay = require('../utils/fedapay');
const { buildReceiptPdf } = require('../utils/pdfBuilder');
const email = require('../utils/email');
const WalletEntry = require('../models/WalletEntry');
const { createPaymentLedger, createLedgerEntryOnce, roundXof } = require('../utils/financial');
const { syncInvoiceStatus } = require('../utils/invoicePayments');
const { applyRefund } = require('../utils/refunds');

const asyncHandler = require('../middleware/asyncHandler');

function mapFedaPayModeToPaymentMethod(mode, fallback = 'carte') {
  const value = String(mode || '').toLowerCase();
  if (value.includes('mtn')) return 'mtn_money';
  if (value.includes('moov')) return 'moov_money';
  if (value.includes('card') || value.includes('carte') || value.includes('visa') || value.includes('master')) return 'carte';
  if (value.includes('bank') || value.includes('transfer') || value.includes('virement')) return 'virement';
  return fallback;
}

async function nextReceiptNumber(owner) {
  const { nextNumber } = require('../models/Counter');
  return nextNumber(owner, 'recu');
}

async function handleInvoicePaid(transaction) {
  const payment = await Payment.findOne({ fedapayTransactionId: String(transaction.id) });
  if (!payment) {
    console.warn('Webhook FedaPay: aucun paiement local pour la transaction', transaction.id);
    return;
  }
  if (payment.statut === 'echoue') {
    console.error('Webhook FedaPay: transaction approuvée pour un paiement local marqué échoué', transaction.id);
    return;
  }

  // Sécurité : le montant réellement débité chez FedaPay doit correspondre à
  // celui attendu. Sinon on ne crédite rien et on laisse une trace à examiner.
  const paidRemote = Number(transaction.amount);
  if (Number.isFinite(paidRemote) && Math.round(paidRemote) !== Math.round(payment.montant)) {
    console.error(`Webhook FedaPay: montant inattendu pour ${transaction.id} (reçu ${paidRemote}, attendu ${payment.montant}). Aucun crédit effectué.`);
    await Payment.updateOne({ _id: payment._id, statut: { $ne: 'complete' } }, { $set: { litige: true, litigeNote: `Montant FedaPay inattendu : ${paidRemote} au lieu de ${payment.montant}` } });
    return;
  }

  const actualPayinFee = roundXof(transaction.fees || transaction.fee || transaction.commission || 0);
  const montantFacture = payment.montantFacture || payment.montant;
  const netUtilisateur = payment.fraisSupportesPar === 'client'
    ? montantFacture
    : Math.max(0, montantFacture - actualPayinFee - (payment.fraisPayoutProvisionnes || 0));

  // 1) Prise en charge ATOMIQUE : un seul des webhooks simultanés passe de
  //    « non complété » à « complété ». Les autres ne refont pas l'encaissement.
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, statut: { $ne: 'complete' } },
    {
      $set: {
        statut: 'complete',
        fedapayMode: transaction.mode || '',
        methode: mapFedaPayModeToPaymentMethod(transaction.mode, payment.methode),
        fraisPayin: actualPayinFee,
        montantClientPaye: payment.montant,
        montantFacture,
        montantNetUtilisateur: payment.montantNetUtilisateur || netUtilisateur,
      },
    },
    { returnDocument: 'after' }
  );
  const firstDelivery = !!claimed;
  let current = claimed || (await Payment.findById(payment._id));
  if (!current) return;

  // 2) Étapes REPRENABLES : si le serveur s'est arrêté après l'étape 1, le
  //    retry de FedaPay passe ici et termine le travail (rien n'est dupliqué).
  if (!current.receiptNumber) {
    const number = await nextReceiptNumber(current.owner);
    const withReceipt = await Payment.findOneAndUpdate(
      { _id: current._id, $or: [{ receiptNumber: '' }, { receiptNumber: null }] },
      { $set: { receiptNumber: number } },
      { returnDocument: 'after' }
    );
    current = withReceipt || (await Payment.findById(current._id));
  }

  // Le ledger conserve les fonds effectivement disponibles chez FedaPay.
  // Frais à la charge de l'utilisateur : crédit après Pay-in. Frais à la charge
  // du client : le supplément destiné au futur reversement reste crédité.
  const creditBrut = current.fraisSupportesPar === 'client'
    ? current.montantClientPaye - current.fraisPayin
    : Math.max(0, current.montantFacture - current.fraisPayin);
  await createPaymentLedger({
    payment: current,
    montantCredit: creditBrut,
    description: `Encaissement en ligne de la facture ${current.invoice}`,
  });

  // Les frais de reversement ne sont PAS provisionnés ici : ils sont prélevés
  // au moment du reversement, sur le solde réellement disponible (voir
  // utils/payout.js). Une provision estimative au crédit créait un écart entre
  // le solde affiché et les fonds réels.

  // Statut de la facture : recalculé depuis les paiements réels et la source
  // unique du total (taxe spécifique et total DGI inclus).
  const synced = await syncInvoiceStatus(current.invoice);
  if (!synced) return;

  // Les emails ne partent qu'à la première livraison du webhook.
  if (!firstDelivery) return;
  const invoice = await Invoice.findById(current.invoice).populate('client');
  if (!invoice) return;
  const user = await User.findById(invoice.owner);
  if (user && invoice.client?.email) {
    try {
      const buffer = await buildReceiptPdf({ invoice, payment: current, user });
      await email.sendReceiptEmail({ to: invoice.client.email, invoice, user, payment: current, pdfBuffer: buffer });
    } catch (err) {
      console.error("Échec d'envoi du reçu par email:", err.message);
    }
  }
  if (user?.email) {
    try {
      await email.sendOwnerPaymentNotification({
        to: user.email, invoice, payment: current, clientNom: invoice.client?.nom || 'Client',
      });
    } catch (err) {
      console.error("Échec de notification propriétaire:", err.message);
    }
  }
}


async function handlePayoutEvent(entity) {
  const Payout = require('../models/Payout');
  const payoutId = entity?.id || entity?.payout_id;
  if (!payoutId) return;
  const payout = await Payout.findOne({ fedapayPayoutId: String(payoutId) });
  if (!payout) return;
  // Même logique que la réconciliation planifiée : statut distant + écritures
  // de ledger idempotentes (libération en cas d'échec, restitution de l'écart).
  const { reconcilePayout } = require('../utils/payout');
  await reconcilePayout(payout);
}

async function handleInvoiceRefund(transaction) {
  await applyRefund({ fedapayTransactionId: String(transaction.id) });
}

async function handleSubscriptionPaid(transaction) {
  const meta = transaction.custom_metadata || {};
  const subscriptionId = meta.subscriptionId;
  if (!subscriptionId) return;

  const sub = await Subscription.findById(subscriptionId);
  if (!sub) return;

  // Le montant réellement débité doit correspondre à l'abonnement commandé.
  const paidRemote = Number(transaction.amount);
  if (Number.isFinite(paidRemote) && Math.round(paidRemote) !== Math.round(sub.montant)) {
    console.error(`Webhook FedaPay (abonnement): montant inattendu pour ${transaction.id} (reçu ${paidRemote}, attendu ${sub.montant}). Aucune activation.`);
    return;
  }

  const DUREE_MS = { '1mois': 30 * 24 * 3600 * 1000, '6mois': 183 * 24 * 3600 * 1000, '1an': 365 * 24 * 3600 * 1000 };
  const now = new Date();
  const dureeMs = DUREE_MS[sub.duree] || DUREE_MS['1mois'];
  // Renouvellement anticipé : la nouvelle période commence à la fin de la
  // période encore active, pour ne pas faire perdre des jours déjà payés.
  const currentUser = await User.findById(sub.owner).select('abonnement subscription');
  const currentEnd = currentUser?.abonnement?.dateFin ? new Date(currentUser.abonnement.dateFin) : null;
  const startsAt = currentEnd && currentEnd > now && currentUser.subscription !== 'gratuit' ? currentEnd : now;

  // Mise à jour atomique : deux retries FedaPay simultanés ne peuvent pas
  // transformer le même abonnement deux fois ni décaler sa date de début.
  const updated = await Subscription.findOneAndUpdate(
    { _id: sub._id, statut: { $ne: 'payee' } },
    {
      $set: {
        statut: 'payee',
        fedapayTransactionId: String(transaction.id),
        dateDebut: startsAt,
        dateFin: new Date(startsAt.getTime() + dureeMs),
      },
    },
    { returnDocument: 'after' }
  );

  if (!updated) return;

  await User.findByIdAndUpdate(updated.owner, {
    subscription: updated.plan,
    abonnement: { duree: updated.duree, dateDebut: updated.dateDebut, dateFin: updated.dateFin },
  });

  // Même lors d'un retry du webhook, la commission reste protégée par son
  // index unique sur subscription.
  try {
    const affiliate = require('./affiliateController');
    await affiliate.applySubscriptionCommission(updated);
  } catch (err) {
    console.error('[affiliate] commission abonnement impossible:', err.message);
  }
}

// POST /api/webhooks/fedapay — corps BRUT (voir server.js)
exports.fedapayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-fedapay-signature'];
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET;
  const rawBody = req.body; // Buffer, grâce à express.raw() sur cette route

  if (!secret) {
    console.error('FEDAPAY_WEBHOOK_SECRET non défini : webhook refusé pour éviter tout crédit financier non authentifié.');
    return res.status(503).json({ message: 'Webhook FedaPay non configuré.' });
  }
  const valid = fedapay.verifyWebhookSignature(rawBody.toString('utf8'), signature, secret);
  if (!valid) {
    console.warn('Webhook FedaPay: signature invalide, requête rejetée.');
    return res.status(400).json({ message: 'Signature invalide' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Corps JSON invalide' });
  }

  const eventName = event.name || event.event;
  const entity = event.entity || event.data || {};

  // On ne fait confiance qu'au statut retourné par l'API (pas seulement au nom de l'event)
  if (eventName?.startsWith('payout.')) {
    await handlePayoutEvent(entity);
  } else if (eventName?.startsWith('transaction.refund')) {
    const transaction = await fedapay.getTransaction(entity.id);
    await handleInvoiceRefund(transaction);
  } else if (eventName === 'transaction.approved' || entity.status === 'approved') {
    const transaction = await fedapay.getTransaction(entity.id);
    if (transaction.status !== 'approved') {
      return res.json({ received: true, ignored: true });
    }
    const meta = transaction.custom_metadata || {};
    if (meta.type === 'subscription') {
      await handleSubscriptionPaid(transaction);
    } else {
      await handleInvoicePaid(transaction);
    }
  }

  res.json({ received: true });
});
