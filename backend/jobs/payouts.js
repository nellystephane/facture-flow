const cron = require('node-cron');
const User = require('../models/User');
const Payout = require('../models/Payout');
const { createPayoutForOwner, reconcilePayout } = require('../utils/payout');

// Les reversements sont réels : aucun mode simulation n'est utilisé. Si FedaPay
// n'est pas configuré/autorisé, le job laisse les fonds intacts et journalise
// l'erreur au lieu de créer un faux transfert.
async function executerReversements() {
  const users = await User.find({
    compteProprietaire: null,
    'payoutSettings.enabled': true,
  }).select('_id payoutSettings');

  for (const user of users) {
    try {
      const schedule = user.payoutSettings?.schedule || 'weekly';
      const now = new Date();
      const last = await Payout.findOne({ owner: user._id, statut: 'sent' }).sort({ sentAt: -1, createdAt: -1 }).select('sentAt createdAt');
      const lastDate = last?.sentAt || last?.createdAt || null;
      let eligible = !lastDate;
      if (lastDate) {
        const d = new Date(lastDate);
        if (schedule === 'monthly') {
          eligible = now.getFullYear() > d.getFullYear() || (now.getFullYear() === d.getFullYear() && now.getMonth() > d.getMonth());
        } else {
          eligible = now.getTime() - d.getTime() >= 7 * 24 * 3600 * 1000;
        }
      }
      if (!eligible) continue;
      await createPayoutForOwner(user._id);
    } catch (err) {
      console.error(`Reversement Oryxa échoué pour ${user._id}:`, err.message);
    }
  }

  // Réconciliation légère des reversements en cours : FedaPay reste la source
  // de vérité pour le statut distant et les frais réellement facturés.
  const actifs = await Payout.find({ statut: { $in: ['pending', 'started', 'processing'] }, fedapayPayoutId: { $ne: null } }).limit(100);
  for (const payout of actifs) {
    try { await reconcilePayout(payout); } catch (err) { console.error('Réconciliation payout:', err.message); }
  }
}

function demarrerReversementsAutomatiques() {
  cron.schedule('15 2 * * *', () => executerReversements().catch((e) => console.error('Job reversements:', e)));
}

module.exports = { demarrerReversementsAutomatiques, executerReversements };
