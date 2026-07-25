const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const fedapay = require('../utils/fedapay');
const { buildReceiptPdf } = require('../utils/pdfBuilder');
const email = require('../utils/email');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur webhook:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  });

async function nextReceiptNumber(owner) {
  const year = new Date().getFullYear();
  const count = await Payment.countDocuments({ owner, statut: 'complete' });
  return `REC-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function handleInvoicePaid(transaction) {
  const payment = await Payment.findOne({ fedapayTransactionId: String(transaction.id) });
  if (!payment) {
    console.warn('Webhook FedaPay: aucun paiement local pour la transaction', transaction.id);
    return;
  }
  if (payment.statut === 'complete') return; // déjà traité (idempotence)

  payment.statut = 'complete';
  payment.fedapayMode = transaction.mode || '';
  payment.receiptNumber = await nextReceiptNumber(payment.owner);
  await payment.save();

  const invoice = await Invoice.findById(payment.invoice).populate('client');
  if (!invoice) return;

  const payments = await Payment.find({ invoice: invoice._id, statut: 'complete' });
  const totalPaye = payments.reduce((s, p) => s + (p.montant || 0), 0);
  const sousTotal = (invoice.items || []).reduce((s, i) => s + (i.quantite || 0) * (i.prixUnitaire || 0), 0);
  const ttc = (sousTotal - (invoice.remise || 0)) * (1 + (invoice.tva || 0) / 100);

  invoice.statut = totalPaye >= ttc - 0.01 ? 'payee' : 'envoyee';
  await invoice.save();

  const user = await User.findById(invoice.owner);
  if (user && invoice.client?.email) {
    try {
      const buffer = await buildReceiptPdf({ invoice, payment, user });
      await email.sendReceiptEmail({ to: invoice.client.email, invoice, user, payment, pdfBuffer: buffer });
    } catch (err) {
      console.error("Échec d'envoi du reçu par email:", err.message);
    }
  }
  if (user?.email) {
    try {
      await email.sendOwnerPaymentNotification({
        to: user.email, invoice, payment, clientNom: invoice.client?.nom || 'Client',
      });
    } catch (err) {
      console.error("Échec de notification propriétaire:", err.message);
    }
  }
}

async function handleSubscriptionPaid(transaction) {
  const meta = transaction.custom_metadata || {};
  const sub = await Subscription.findById(meta.subscriptionId);
  if (!sub || sub.statut === 'payee') return;

  sub.statut = 'payee';
  const now = new Date();
  const dureeMs = sub.duree === '1an' ? 365 * 24 * 3600 * 1000 : 183 * 24 * 3600 * 1000;
  sub.dateDebut = now;
  sub.dateFin = new Date(now.getTime() + dureeMs);
  await sub.save();

  await User.findByIdAndUpdate(sub.owner, {
    subscription: sub.plan,
    abonnement: { duree: sub.duree, dateDebut: sub.dateDebut, dateFin: sub.dateFin },
  });
}

// POST /api/webhooks/fedapay — corps BRUT (voir server.js)
exports.fedapayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-fedapay-signature'];
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET;
  const rawBody = req.body; // Buffer, grâce à express.raw() sur cette route

  if (secret) {
    const valid = fedapay.verifyWebhookSignature(rawBody.toString('utf8'), signature, secret);
    if (!valid) {
      console.warn('Webhook FedaPay: signature invalide, requête rejetée.');
      return res.status(400).json({ message: 'Signature invalide' });
    }
  } else {
    console.warn('FEDAPAY_WEBHOOK_SECRET non défini — signature non vérifiée (à corriger avant la mise en production).');
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
  if (eventName === 'transaction.approved' || entity.status === 'approved') {
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
