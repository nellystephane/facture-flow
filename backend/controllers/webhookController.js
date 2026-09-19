const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const fedapay = require('../utils/fedapay');
const { buildReceiptPdf } = require('../utils/pdfBuilder');
const email = require('../utils/email');
const { createPaymentLedger, roundXof } = require('../utils/financial');

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
  if (payment.statut === 'complete') return; // déjà traité (idempotence)

  payment.statut = 'complete';
  payment.fedapayMode = transaction.mode || '';
  payment.methode = mapFedaPayModeToPaymentMethod(transaction.mode, payment.methode);
  const actualPayinFee = roundXof(transaction.fees || transaction.fee || transaction.commission || 0);
  payment.fraisPayin = actualPayinFee;
  payment.montantClientPaye = payment.montant;
  if (!payment.montantFacture) payment.montantFacture = payment.montant;
  if (!payment.montantNetUtilisateur) {
    payment.montantNetUtilisateur = payment.fraisSupportesPar === 'client'
      ? payment.montantFacture
      : Math.max(0, payment.montantFacture - actualPayinFee - (payment.fraisPayoutProvisionnes || 0));
  }
  payment.receiptNumber = await nextReceiptNumber(payment.owner);
  await payment.save();
  // Le ledger conserve les fonds effectivement disponibles chez FedaPay.
  // Lorsque l'Utilisateur supporte les frais, le crédit est après Pay-in.
  // Lorsque le Client supporte les frais, le supplément destiné au futur
  // payout reste également crédité : il servira à payer le coût réel du
  // reversement sans diminuer le montant commercial dû à l'Utilisateur.
  const creditBrut = payment.fraisSupportesPar === 'client'
    ? payment.montantClientPaye - actualPayinFee
    : Math.max(0, payment.montantFacture - actualPayinFee);
  await createPaymentLedger({
    payment,
    montantCredit: creditBrut,
    description: `Encaissement en ligne de la facture ${payment.invoice}`,
  });
  // Le payout prévisionnel est réservé une seule fois ici. Cette provision
  // sert à ce que `solde retirable` soit déjà net du coût de reversement.
  // Au moment du payout, on transfère exactement ce solde réservé et FedaPay
  // débite en plus le coût réel ; si ce coût réel dépasse la provision, la
  // cible de transfert est réduite avant /start. Il n'y a donc jamais deux
  // débits du même frais.
  const payoutReserve = roundXof(payment.fraisPayoutProvisionnes || 0);
  if (payoutReserve > 0) {
    const WalletEntry = require('../models/WalletEntry');
    const existingReserve = await WalletEntry.findOne({
      payment: payment._id,
      type: 'debit_frais',
      'metadata.kind': 'payout_reserve',
    });
    if (!existingReserve) {
      await WalletEntry.create({
        owner: payment.owner,
        type: 'debit_frais',
        montant: payoutReserve,
        payment: payment._id,
        reference: `payout-reserve-${payment._id}`,
        description: 'Provision estimative des frais de reversement FedaPay',
        metadata: { kind: 'payout_reserve', source: 'payment_quote', estimateOnlyUntilPayout: true },
      });
    }
  }


  const invoice = await Invoice.findById(payment.invoice).populate('client');
  if (!invoice) return;

  const payments = await Payment.find({ invoice: invoice._id, statut: 'complete' });
  const totalPaye = payments.reduce((s, p) => s + (p.montantFacture ?? p.montant ?? 0), 0);
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


async function handlePayoutEvent(entity) {
  const Payout = require('../models/Payout');
  const payoutId = entity?.id || entity?.payout_id;
  if (!payoutId) return;
  const payout = await Payout.findOne({ fedapayPayoutId: String(payoutId) });
  if (!payout) return;
  const remote = await fedapay.getPayout(payoutId);
  payout.fedapayStatus = remote.status || entity.status || '';
  const remoteStatus = String(remote.status || entity.status || payout.statut).toLowerCase();
  payout.statut = remoteStatus === 'scheduled' ? 'processing' : (['pending', 'started', 'processing', 'sent', 'failed'].includes(remoteStatus) ? remoteStatus : 'processing');
  payout.fraisFedaPay = roundXof(remote.fees || remote.fixed_commission || 0);
  payout.commissionFedaPay = roundXof(remote.commission || 0);
  payout.montantTransfere = roundXof(remote.amount_transferred || 0);
  payout.montantDebite = roundXof(remote.amount_debited || 0);
  if (remote.sent_at) payout.sentAt = new Date(remote.sent_at);
  if (remote.failed_at) payout.failedAt = new Date(remote.failed_at);
  if (remote.last_error_code) payout.erreur = String(remote.last_error_code);
  await payout.save();
}

async function handleInvoiceRefund(transaction) {
  const Payment = require('../models/Payment');
  const WalletEntry = require('../models/WalletEntry');
  const payment = await Payment.findOne({ fedapayTransactionId: String(transaction.id), statut: 'complete' });
  if (!payment || payment.rembourse) return;
  payment.rembourse = true;
  payment.rembourseLe = new Date();
  await payment.save();
  const montant = roundXof(payment.montantNetUtilisateur || payment.montantFacture || payment.montant);
  if (montant > 0) {
    const exists = await WalletEntry.findOne({ payment: payment._id, type: 'debit_remboursement' });
    if (!exists) {
      await WalletEntry.create({
        owner: payment.owner,
        type: 'debit_remboursement',
        montant,
        payment: payment._id,
        reference: `refund-${payment._id}`,
        description: 'Remboursement FedaPay confirmé',
      });
    }
  }
}

async function handleSubscriptionPaid(transaction) {
  const meta = transaction.custom_metadata || {};
  const sub = await Subscription.findById(meta.subscriptionId);
  if (!sub || sub.statut === 'payee') return;

  sub.statut = 'payee';
  const now = new Date();
  const DUREE_MS = { '1mois': 30 * 24 * 3600 * 1000, '6mois': 183 * 24 * 3600 * 1000, '1an': 365 * 24 * 3600 * 1000 };
  const dureeMs = DUREE_MS[sub.duree] || DUREE_MS['1mois'];
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
