// Monitoring d'erreurs (Sentry). Complètement optionnel : si SENTRY_DSN
// n'est pas défini, l'app fonctionne normalement, juste sans remontée
// automatique des erreurs vers un tableau de bord — comme pour l'email
// (BREVO_SMTP_*) et le paiement (FEDAPAY_*), une intégration absente ne doit
// jamais empêcher le reste de l'app de fonctionner.
let Sentry = null;

if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      // Échantillonnage des traces de performance : 10% suffit largement
      // pour une app de cette taille et limite le volume envoyé à Sentry.
      tracesSampleRate: 0.1,
    });
    console.log('Sentry activé : les erreurs serveur seront remontées.');
  } catch (err) {
    // Le package @sentry/node doit être dans package.json (voir
    // dependencies) — s'il manque au build, on continue sans planter.
    console.warn("SENTRY_DSN est défini mais le package '@sentry/node' est introuvable :", err.message);
    Sentry = null;
  }
} else {
  console.log("SENTRY_DSN absent — monitoring des erreurs désactivé (voir backend/.env.example pour l'activer).");
}

function captureException(err, context) {
  if (Sentry) Sentry.captureException(err, context ? { extra: context } : undefined);
}

module.exports = { Sentry, captureException };
