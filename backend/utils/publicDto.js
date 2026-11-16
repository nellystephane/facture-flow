'use strict';

// Objets renvoyés aux pages PUBLIQUES (client final, sans compte). Liste blanche
// stricte : avant, la facture, le client et tous les paiements étaient renvoyés
// tels quels (identifiants FedaPay, notes internes, coordonnées complètes...).

const { computeInvoiceTotals, paidAmountOf } = require('./invoiceTotals');

function pickClient(client) {
  if (!client || typeof client !== 'object' || client.nom === undefined) return null;
  return {
    nom: client.nom || '',
    entreprise: client.entreprise || '',
    email: client.email || '',
    telephone: client.telephone || '',
    whatsapp: client.whatsapp || '',
  };
}

function pickItems(items) {
  return (items || []).map((i) => ({
    description: i.description,
    quantite: i.quantite,
    prixUnitaire: i.prixUnitaire,
  }));
}

function pickEmetteur(user, { withBanque = false } = {}) {
  if (!user) return null;
  const out = {
    nom: user.nom || '',
    entreprise: user.entreprise || '',
    email: user.email || '',
    telephone: user.telephone || '',
    whatsapp: user.whatsapp || '',
    adresse: user.adresse || '',
    devise: user.devise || 'FCFA',
    logoUrl: user.logoUrl || '',
  };
  if (withBanque) out.banque = user.banque || undefined;
  return out;
}

function publicInvoiceDto(invoice) {
  const t = computeInvoiceTotals(invoice);
  const f = invoice.fiscalisation || {};
  return {
    _id: String(invoice._id),
    numero: invoice.numero,
    objet: invoice.objet || '',
    statut: invoice.statut,
    dateEmission: invoice.dateEmission,
    dateEcheance: invoice.dateEcheance,
    items: pickItems(invoice.items),
    remise: t.remise,
    tva: invoice.tva || 0,
    notes: invoice.notes || '',
    fraisSupportesPar: invoice.fraisSupportesPar || 'utilisateur',
    client: pickClient(invoice.client),
    fiscalisation: f.status === 'confirmed'
      ? { status: 'confirmed', dgiTotal: t.fiscalTotal }
      : { status: f.status || 'none' },
  };
}

function publicPaymentDto(payment) {
  return {
    _id: String(payment._id),
    montant: payment.montant,
    montantFacture: paidAmountOf(payment),
    statut: payment.statut,
    methode: payment.methode,
    date: payment.date,
    receiptNumber: payment.receiptNumber || '',
    rembourse: !!payment.rembourse,
  };
}

function publicQuoteDto(quote) {
  return {
    _id: String(quote._id),
    numero: quote.numero,
    objet: quote.objet || '',
    statut: quote.statut,
    dateEmission: quote.dateEmission,
    dateExpiration: quote.dateExpiration,
    items: pickItems(quote.items),
    remise: quote.remise || 0,
    tva: quote.tva || 0,
    notes: quote.notes || '',
    client: pickClient(quote.client),
  };
}

module.exports = { publicInvoiceDto, publicPaymentDto, publicQuoteDto, pickEmetteur };
