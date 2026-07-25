const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const Payment = require('../models/Payment');
const Quote = require('../models/Quote');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  });

const calcTTC = (inv) => {
  const ht = (inv.items || []).reduce((s, i) => s + (i.quantite || 0) * (i.prixUnitaire || 0), 0)
    - (inv.remise || 0);
  return ht * (1 + (inv.tva || 0) / 100);
};

exports.getDashboard = asyncHandler(async (req, res) => {
  const [invoices, clients, payments] = await Promise.all([
    Invoice.find({ owner: req.userId }).populate('client'),
    Client.countDocuments({ owner: req.userId }),
    Payment.find({ owner: req.userId })
  ]);

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

  const totalPaye = payments.reduce((s, p) => s + (p.montant || 0), 0);

  // Revenus par mois (6 derniers mois)
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

  // Top clients
  const parClient = {};
  invoices.filter((i) => i.statut === 'payee').forEach((inv) => {
    const key = inv.client?.nom || 'Inconnu';
    parClient[key] = (parClient[key] || 0) + calcTTC(inv);
  });
  const topClients = Object.entries(parClient)
    .map(([nom, total]) => ({ nom, total: Math.round(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  res.json({
    totalFactures: invoices.length,
    chiffreAffaires: Math.round(chiffreAffaires),
    enAttente: Math.round(enAttente),
    enRetard: Math.round(enRetard),
    totalClients: clients,
    totalPaye: Math.round(totalPaye),
    revenusMensuels,
    topClients,
    facturesRecentes: invoices.slice(0, 5)
  });
});
