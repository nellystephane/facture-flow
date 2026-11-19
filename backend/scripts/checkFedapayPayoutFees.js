// Vérifie en SANDBOX comment FedaPay calcule les frais de reversement.
// Crée un payout de test (sans jamais l'exécuter : /start n'est PAS appelé) et
// affiche montant, frais et montant débité pour plusieurs montants.
//   FEDAPAY_ENVIRONMENT=sandbox FEDAPAY_SECRET_KEY=sk_sandbox_... FEDAPAY_PAYOUTS_ENABLED=true \
//   node scripts/checkFedapayPayoutFees.js 5000 10000 50000
// Lecture du résultat :
//   débité = montant + frais  -> les frais s'ajoutent (cas géré par Oryxa : le montant versé est réduit)
//   débité = montant          -> les frais sont inclus dans le montant (cas géré aussi)
require('dotenv').config();
const fedapay = require('../utils/fedapay');

(async () => {
  const env = String(process.env.FEDAPAY_ENVIRONMENT || '').toLowerCase();
  if (env === 'live') {
    console.error('Refus : environnement live détecté. Ce script ne doit jamais tourner en live.');
    process.exit(1);
  }
  const amounts = process.argv.slice(2).map(Number).filter((n) => n > 0);
  if (!amounts.length) amounts.push(2000, 5000, 10000, 50000);
  for (const amount of amounts) {
    try {
      const p = await fedapay.createPayout({
        amount, mode: 'mobile_money',
        customer: { firstname: 'Test', lastname: 'Frais', email: 'frais@example.com', phone: process.env.TEST_PAYOUT_PHONE || '97000000' },
        metadata: { type: 'oryxa_fee_probe' },
      });
      const debite = Number(p.amount_debited || 0);
      console.log(`montant ${amount} | frais ${p.fees ?? p.commission ?? '?'} | transféré ${p.amount_transferred ?? p.amount} | débité ${debite} | ${debite > amount ? 'frais AJOUTÉS' : debite === amount ? 'frais INCLUS' : 'inconnu'}`);
    } catch (err) {
      console.error(`montant ${amount} : ${err.message}`);
    }
  }
})();
