'use strict';

const cron = require('node-cron');
const { withJobLock } = require('../utils/jobLock');
const RecurringInvoice = require('../models/RecurringInvoice');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const { nextNumber } = require('../models/Counter');
const { permissionsDe } = require('../utils/permissions');
const { prochaineDate } = require('../utils/recurring');
const { appliquerStockFacture } = require('../utils/stock');

function paymentUrlFor(invoice) {
  const base = process.env.CLIENT_URL_PUBLIC || (process.env.CLIENT_URL || '').split(',')[0];
  if (!base || !invoice.publicToken) return null;
  return `${base.replace(/\/$/, '')}/payer/${invoice.publicToken}`;
}

// Crée la facture réelle d'un modèle récurrent. Retourne la facture.
async function genererFacture(modele, user, now = new Date()) {
  const echeance = new Date(now.getTime() + (modele.delaiEcheanceJours || 0) * 86400000);
  const invoice = await Invoice.create({
    owner: modele.owner,
    client: modele.client,
    numero: await nextNumber(modele.owner, 'facture'),
    objet: modele.objet || modele.titre,
    dateEmission: now,
    dateEcheance: echeance,
    items: modele.items.map((i) => ({ description: i.description, quantite: i.quantite, prixUnitaire: i.prixUnitaire, service: i.service || null })),
    devise: modele.devise || 'XOF',
    tauxChange: modele.tauxChange || 1,
    remise: modele.remise,
    tva: modele.tva,
    notes: modele.notes,
    fraisSupportesPar: modele.fraisSupportesPar,
    statut: 'brouillon',
  });

  let erreur = '';
  if (modele.envoiAutomatique) {
    try {
      const email = require('../utils/email');
      const { buildInvoicePdf } = require('../utils/pdfBuilder');
      await invoice.populate('client');
      if (!invoice.client?.email) throw new Error("le client n'a pas d'adresse e-mail");
      const url = paymentUrlFor(invoice);
      const pdfBuffer = await buildInvoicePdf({ invoice, user, paymentUrl: url });
      await email.sendInvoiceEmail({ to: invoice.client.email, invoice, user, pdfBuffer, paymentUrl: url });
      invoice.statut = 'envoyee';
      invoice.dateEnvoi = new Date();
      await invoice.save();
      await appliquerStockFacture(invoice._id);
    } catch (err) {
      erreur = `Facture ${invoice.numero} créée en brouillon, envoi impossible : ${err.message}`;
    }
  }
  return { invoice, erreur };
}

async function executerFacturesRecurrentes(now = new Date()) {
  const dues = await RecurringInvoice.find({ actif: true, prochaineEmission: { $lte: now } }).limit(500);
  let generees = 0;
  let erreurs = 0;

  for (const m of dues) {
    // Plus de date de fin : on désactive proprement.
    if (m.dateFin && m.prochaineEmission > m.dateFin) {
      await RecurringInvoice.updateOne({ _id: m._id }, { $set: { actif: false } });
      continue;
    }
    const user = await User.findById(m.owner);
    if (!user || !permissionsDe(user).peutUtiliserFacturesRecurrentes()) continue; // plan expiré : on ne génère pas

    // Prise du tour de façon atomique : seul un exécuteur avance la date.
    const suivante = prochaineDate(m.prochaineEmission, m.frequence, m.jourAncre);
    const claimed = await RecurringInvoice.findOneAndUpdate(
      { _id: m._id, actif: true, prochaineEmission: m.prochaineEmission },
      { $set: { prochaineEmission: suivante, derniereGeneration: now, derniereErreur: '' }, $inc: { nombreGenerees: 1 } },
      { returnDocument: 'before' }
    );
    if (!claimed) continue;

    try {
      const { invoice, erreur } = await genererFacture(claimed, user, now);
      generees += 1;
      if (erreur) { erreurs += 1; await RecurringInvoice.updateOne({ _id: m._id }, { $set: { derniereErreur: erreur } }); }
      if (m.dateFin && suivante > m.dateFin) await RecurringInvoice.updateOne({ _id: m._id }, { $set: { actif: false } });
      void invoice;
    } catch (err) {
      erreurs += 1;
      console.error('[cron] Facture récurrente échouée', String(m._id), err.message);
      await RecurringInvoice.updateOne({ _id: m._id }, { $set: { derniereErreur: `Génération impossible : ${err.message}` } });
    }
  }
  if (generees || erreurs) console.log(`[cron] Factures récurrentes : ${generees} créée(s), ${erreurs} erreur(s).`);
  return { generees, erreurs };
}

function demarrerFacturesRecurrentes() {
  cron.schedule('30 6 * * *', () => {
    withJobLock('job:recurrentes', 30 * 60 * 1000, () => executerFacturesRecurrentes()).catch((err) => {
      console.error('[cron] Échec des factures récurrentes :', err.message);
    });
  });
  console.log('[cron] Factures récurrentes programmées (6h30).');
}

module.exports = { executerFacturesRecurrentes, demarrerFacturesRecurrentes, genererFacture };
