'use strict';

const crypto = require('crypto');
const express = require('express');
const { withJobLock } = require('../utils/jobLock');

const router = express.Router();

// Déclencheurs externes des tâches planifiées. Sur un hébergement qui met le
// serveur en veille (offre gratuite), les crons internes ne s'exécutent pas :
// un planificateur externe (cron-job.org, Render Cron...) appelle ces URL avec
// l'en-tête `x-cron-secret`. Le verrou garantit qu'un double appel est sans effet.
function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 24) return res.status(503).json({ message: 'CRON_SECRET non configuré (24 caractères minimum).' });
  const provided = String(req.headers['x-cron-secret'] || '');
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ message: 'Non autorisé.' });
  next();
}

const JOBS = {
  reversements: () => require('../jobs/payouts').executerReversements,
  relances: () => require('../jobs/paymentReminders').executerRelances,
  abonnements: () => require('../jobs/cleanExpiredSubscriptions').nettoyerAbonnementsExpires,
  comptes: () => require('../jobs/cleanUnverifiedAccounts').nettoyerComptesNonConfirmes,
};

router.post('/jobs/:name', requireCronSecret, async (req, res) => {
  const load = JOBS[req.params.name];
  if (!load) return res.status(404).json({ message: 'Tâche inconnue.' });
  try {
    const out = await withJobLock(`job:${req.params.name}`, 30 * 60 * 1000, () => load()());
    res.json({ job: req.params.name, skipped: out.skipped });
  } catch (err) {
    console.error(`Job ${req.params.name}:`, err);
    res.status(500).json({ message: 'La tâche a échoué.' });
  }
});

module.exports = router;
