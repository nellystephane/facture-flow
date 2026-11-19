'use strict';

const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const { PAID_PAYMENT_FILTER, computeInvoiceTotals, isFullyPaid } = require('./invoiceTotals');

// Somme déjà imputée à la facture (paiements confirmés, non remboursés).
async function getTotalPaye(invoiceId) {
  const id = invoiceId instanceof mongoose.Types.ObjectId ? invoiceId : new mongoose.Types.ObjectId(String(invoiceId));
  const rows = await Payment.aggregate([
    { $match: { invoice: id, ...PAID_PAYMENT_FILTER } },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$montantFacture', '$montant'] } } } },
  ]);
  return Number(rows[0]?.total || 0);
}

async function getInvoiceBalance(invoice) {
  const totals = computeInvoiceTotals(invoice);
  const totalPaye = await getTotalPaye(invoice._id);
  // Une fois la facture confirmée par la DGI, son total peut différer de 1-2
  // FCFA du calcul HT global (arrondi par ligne). Un client qui a payé le
  // montant affiché avant la confirmation ne doit pas repasser « impayé » pour
  // cet écart : on tolère 0,5 FCFA par unité vendue.
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const tolerance = totals.fiscalTotal !== null
    ? Math.ceil(items.reduce((s, i) => s + 0.5 * Math.abs(Number(i.quantite) || 0), 0)) + 1
    : 0;
  const estPayee = isFullyPaid(totalPaye, totals.totalDu) || (totals.fiscalTotal !== null && totals.totalDu > 0 && totalPaye >= totals.totalDu - tolerance && totalPaye >= totals.totalTTCCalcule - 1);
  return {
    ...totals,
    totalPaye,
    reste: estPayee ? 0 : Math.max(0, totals.totalDu - totalPaye),
    estPayee,
  };
}

// Déduit le statut commercial de la facture à partir des paiements réels.
// Idempotent : on peut l'appeler autant de fois que nécessaire (retries de
// webhook, suppression d'un paiement manuel, remboursement).
//   - tout est payé            -> payee
//   - plus rien d'entièrement payé alors qu'elle l'était -> envoyee
//   - brouillon avec un paiement -> envoyee
//   - sinon (vue, en_retard...) le statut existant est conservé
function nextStatusFor(currentStatus, { estPayee, totalPaye }) {
  if (currentStatus === 'annulee') return currentStatus;
  if (estPayee) return 'payee';
  if (currentStatus === 'payee') return 'envoyee';
  if (currentStatus === 'brouillon' && totalPaye > 0) return 'envoyee';
  return currentStatus;
}

async function syncInvoiceStatus(invoiceOrId) {
  const invoice = invoiceOrId && invoiceOrId._id ? invoiceOrId : await Invoice.findById(invoiceOrId);
  if (!invoice) return null;
  const balance = await getInvoiceBalance(invoice);
  const next = nextStatusFor(invoice.statut, balance);
  if (next !== invoice.statut) {
    await Invoice.updateOne({ _id: invoice._id, statut: { $ne: 'annulee' } }, { $set: { statut: next } });
    invoice.statut = next;
  }
  if (invoice.statut !== 'brouillon' && invoice.statut !== 'annulee' && !invoice.stockApplique) {
    require('./stock').appliquerStockFacture(invoice._id).catch(() => {});
  }
  return { invoice, balance, statut: next };
}

module.exports = { getTotalPaye, getInvoiceBalance, syncInvoiceStatus, nextStatusFor };
