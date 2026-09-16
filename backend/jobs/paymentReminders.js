const cron = require('node-cron');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const email = require('../utils/email');
const { permissionsDe } = require('../utils/permissions');

const JALONS_JOURS = [3, 7, 15];

function paymentUrlFor(invoice) {
  const base = process.env.CLIENT_URL_PUBLIC || (process.env.CLIENT_URL || '').split(',')[0];
  if (!base || !invoice.publicToken) return null;
  return `${base.replace(/\/$/, '')}/payer/${invoice.publicToken}`;
}

async function executerRelances() {
  const maintenant = new Date();

  const passageEnRetard = await Invoice.updateMany(
    { statut: { $in: ['envoyee', 'vue'] }, dateEcheance: { $lt: maintenant } },
    { $set: { statut: 'en_retard' } }
  );

  const facturesEnRetard = await Invoice.find({ statut: 'en_retard', dateEcheance: { $ne: null } })
    .populate('client', 'nom email')
    .populate('owner');

  let relancesEnvoyees = 0;
  for (const invoice of facturesEnRetard) {
    const owner = invoice.owner;
    if (!owner || !invoice.client?.email) continue;
    if (!permissionsDe(owner).peutUtiliserRelancesAutomatiques()) continue;

    const joursRetard = Math.floor((maintenant - new Date(invoice.dateEcheance)) / 86400000);
    const dejaRelanceAujourdhui = invoice.derniereRelance &&
      new Date(invoice.derniereRelance).toDateString() === maintenant.toDateString();
    const surUnJalon = JALONS_JOURS.includes(joursRetard);
    if (!surUnJalon || dejaRelanceAujourdhui) continue;

    try {
      await email.sendPaymentReminderEmail({
        to: invoice.client.email,
        invoice,
        user: owner,
        paymentUrl: paymentUrlFor(invoice),
        joursRetard,
      });
      invoice.derniereRelance = maintenant;
      await invoice.save();
      relancesEnvoyees += 1;
    } catch (err) {
      console.error(`[cron] Échec de relance pour la facture ${invoice.numero} :`, err.message);
    }
  }

  if (passageEnRetard.modifiedCount > 0 || relancesEnvoyees > 0) {
    console.log(`[cron] Relances : ${passageEnRetard.modifiedCount} facture(s) passée(s) en retard, ${relancesEnvoyees} rappel(s) envoyé(s).`);
  }
  return { passeesEnRetard: passageEnRetard.modifiedCount, relancesEnvoyees };
}

function demarrerRelancesAutomatiques() {
  cron.schedule('0 8 * * *', () => {
    executerRelances().catch((err) => {
      console.error('[cron] Échec des relances automatiques :', err.message);
    });
  });
  console.log('[cron] Relances automatiques programmées (8h00).');
}

module.exports = { executerRelances, demarrerRelancesAutomatiques };
