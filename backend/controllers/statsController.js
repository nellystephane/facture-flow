const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { permissionsDe } = require('../utils/permissions');
const { getWalletBalance } = require('../utils/financial');
const { computeInvoiceTotals, sumPaidXOF } = require('../utils/invoiceTotals');

const asyncHandler = require('../middleware/asyncHandler');

// Même formule que partout ailleurs (taxe spécifique et total DGI inclus).
// Tous les totaux du tableau de bord sont en équivalent FCFA (taux figé de chaque facture).
const calcTTC = (inv) => computeInvoiceTotals(inv).totalXOF;

exports.getDashboard = asyncHandler(async (req, res) => {
  const [user, invoices, clients, payments] = await Promise.all([
    User.findById(req.userId),
    Invoice.find({ owner: req.userId }).populate('client'),
    Client.countDocuments({ owner: req.userId }),
    Payment.find({ owner: req.userId })
  ]);
  const peutVoirAvance = permissionsDe(user).peutVoirStatistiquesAvancees();

  const chiffreAffaires = invoices
    .filter((i) => i.statut === 'payee')
    .reduce((s, i) => s + calcTTC(i), 0);

  const enAttente = invoices
    .filter((i) => ['envoyee', 'vue'].includes(i.statut))
    .reduce((s, i) => s + calcTTC(i), 0);

  const enRetard = invoices
    .filter((i) => i.statut === 'en_retard' ||
      (i.dateEcheance && new Date(i.dateEcheance) < new Date() && i.statut !== 'payee' && i.statut !== 'annulee'))
    .reduce((s, i) => s + calcTTC(i), 0);

  const totalPaye = sumPaidXOF(payments);
  const soldeRetirable = await getWalletBalance(req.userId);

  const dashboard = {
    totalFactures: invoices.length,
    chiffreAffaires: Math.round(chiffreAffaires),
    enAttente: Math.round(enAttente),
    enRetard: Math.round(enRetard),
    totalClients: clients,
    totalPaye: Math.round(totalPaye),
    soldeRetirable: Math.round(soldeRetirable),
    prochainReversement: null,
    facturesRecentes: invoices.slice(0, 5),
    statistiquesAvancees: peutVoirAvance,
  };

  // Évolution mensuelle et top clients : avantage Pro/Business (voir
  // config/plans.js). Le plan Gratuit garde un tableau de bord utile
  // (CA, en attente, en retard, factures récentes) mais sans ces deux
  // vues plus analytiques.
  if (peutVoirAvance) {
    const maintenant = new Date();
    const revenusMensuels = [];
    for (let i = 5; i >= 0; i--) {
      const debut = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
      const fin = new Date(maintenant.getFullYear(), maintenant.getMonth() - i + 1, 1);
      const total = invoices
        .filter((inv) => inv.statut === 'payee' && new Date(inv.dateEmission) >= debut && new Date(inv.dateEmission) < fin)
        .reduce((s, inv) => s + calcTTC(inv), 0);
      revenusMensuels.push({
        mois: debut.toLocaleDateString('fr-FR', { month: 'short' }),
        total: Math.round(total)
      });
    }

    const parClient = {};
    invoices.filter((i) => i.statut === 'payee').forEach((inv) => {
      const key = inv.client?.nom || 'Inconnu';
      parClient[key] = (parClient[key] || 0) + calcTTC(inv);
    });
    const topClients = Object.entries(parClient)
      .map(([nom, total]) => ({ nom, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    dashboard.revenusMensuels = revenusMensuels;
    dashboard.topClients = topClients;
  }

  res.json(dashboard);
});
