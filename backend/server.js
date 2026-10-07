require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

// Doit être importé tôt : initialise Sentry si SENTRY_DSN est configuré
// (no-op silencieux sinon — voir utils/monitoring.js).
const { Sentry, captureException } = require('./utils/monitoring');

const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const statsRoutes = require('./routes/statsRoutes');
const publicRoutes = require('./routes/publicRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const teamRoutes = require('./routes/teamRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const adminRoutes = require('./routes/adminRoutes');
const supportRoutes = require('./routes/supportRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const affiliateRoutes = require('./routes/affiliateRoutes');
const { isEmailConfigured } = require('./utils/email');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

console.log('CORS — origines autorisées :', allowedOrigins);

app.use((req, res, next) => {
  const header = req.headers.cookie || '';
  req.cookies = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) req.cookies[key] = decodeURIComponent(value);
  });
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // requêtes sans origine (curl, health check…)
    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalized)) return callback(null, true);
    console.warn(`CORS refusé pour l'origine "${origin}". Origines autorisées : ${allowedOrigins.join(', ')}. Ajoutez-la à la variable d'environnement CLIENT_URL sur Render si c'est légitime.`);
    callback(new Error('Origine non autorisée par CORS'));
  },
  credentials: true,
}));

// Les webhooks (FedaPay) doivent lire le corps brut AVANT express.json(),
// sinon la vérification de signature échoue.
app.use('/api/webhooks', webhookRoutes);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, réessayez plus tard.' },
  skip: () => process.env.NODE_ENV === 'test',
});
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email || '').trim().toLowerCase()}`,
  message: { message: 'Trop de tentatives, réessayez plus tard.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.params?.token || req.body?.email || '').trim().toLowerCase()}`,
  message: { message: 'Trop de tentatives pour cette opération. Réessayez plus tard.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.params?.token || '').trim()}`,
  message: { message: 'Trop de tentatives de paiement. Réessayez plus tard.' },
  skip: () => process.env.NODE_ENV === 'test',
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/verifier-email', authLimiter);
app.use('/api/auth/renvoyer-code', authLimiter);
app.use('/api/auth/mot-de-passe-oublie', authLimiter);
app.use('/api/auth/reinitialiser-mot-de-passe', authLimiter);
app.use('/api/auth/refresh', sensitiveActionLimiter);
// Même limiteur que la connexion utilisateur : l'espace admin n'a qu'un
// mot de passe partagé (voir docs/ADMIN_ACCESS.md), donc le brute-force
// doit être freiné au moins aussi agressivement qu'ailleurs.
app.use('/api/admin/login', authLimiter);
app.use('/api/admin/refresh', sensitiveActionLimiter);
app.use('/api/public/invoices/:token/pay', paymentLimiter);
app.use('/api/public/quotes/:token/repondre', sensitiveActionLimiter);
app.use('/api/subscription', paymentLimiter);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? 'connecté' : 'déconnecté',
    email: isEmailConfigured() ? 'configuré' : 'non configuré',
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/affiliate', affiliateRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Ressource introuvable' });
});

// Remonte l'erreur à Sentry (si configuré) pour toute erreur qui atteindrait
// ce point via next(err) — la plupart des routes utilisent déjà
// middleware/asyncHandler.js qui journalise et remonte à Sentry lui-même,
// ceci est un filet de sécurité supplémentaire.
if (Sentry) Sentry.setupExpressErrorHandler(app);

// Gestionnaire d'erreurs global (dernier filet de sécurité)
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  captureException(err, { path: req.originalUrl, method: req.method });
  const status = Number(err.status) >= 400 && Number(err.status) < 500 ? Number(err.status) : 500;
  const message = process.env.NODE_ENV === 'production' ? (status < 500 ? (err.publicMessage || err.message || 'Requête invalide.') : 'Une erreur interne est survenue.') : (err.message || 'Erreur serveur');
  res.status(status).json({ message });
});

const { demarrerNettoyageAbonnements } = require('./jobs/cleanExpiredSubscriptions');
const { demarrerRelancesAutomatiques } = require('./jobs/paymentReminders');
const { demarrerNettoyageComptesNonConfirmes } = require('./jobs/cleanUnverifiedAccounts');
const { demarrerReversementsAutomatiques } = require('./jobs/payouts');

const PORT = process.env.PORT || 5000;

async function start() {
  if (process.env.NODE_ENV === 'production') {
    const requiredSecrets = [
      ['JWT_SECRET', process.env.JWT_SECRET],
      ['ADMIN_JWT_SECRET', process.env.ADMIN_JWT_SECRET],
    ];
    const weak = requiredSecrets.filter(([, value]) => !value || value.length < 32).map(([name]) => name);
    if (weak.length) {
      console.error(`Secrets de production invalides ou absents : ${weak.join(', ')}. Chaque secret doit être indépendant et faire au moins 32 caractères.`);
      process.exit(1);
    }
    if (!process.env.ADMIN_PASSWORD_HASH) {
      console.error('ADMIN_PASSWORD_HASH est obligatoire en production. Le mot de passe admin en clair est désactivé.');
      process.exit(1);
    }
    const { getConfiguredAdminEmail } = require('./utils/adminConfig');
    if (!getConfiguredAdminEmail()) {
      console.error('Un seul administrateur doit être configuré : ADMIN_EMAIL (ou temporairement ADMIN_EMAILS avec exactement une adresse).');
      process.exit(1);
    }
  }
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI manquant dans les variables d'environnement.");
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connecté');
    // Oryxa est actuellement mono-devise : normalise les anciens comptes en FCFA.
    try {
      const User = require('./models/User');
      const migration = await User.updateMany({ devise: { $ne: 'FCFA' } }, { $set: { devise: 'FCFA' } });
      if (migration.modifiedCount) console.log(`Devise normalisée en FCFA pour ${migration.modifiedCount} compte(s).`);
    } catch (err) {
      console.error('Migration devise FCFA impossible :', err.message);
    }

    // Corrige les anciens index uniques sur Invoice.quote/publicToken avant
    // d'accepter des requêtes. Sans cette migration, une base existante peut
    // conserver l'ancien quote_1 et rejeter toute deuxième facture sans devis.
    try {
      const { migrateInvoiceIndexes } = require('./scripts/migrateInvoiceIndexes');
      await migrateInvoiceIndexes();
    } catch (err) {
      console.error('Migration des index Invoice impossible :', err.message);
      process.exit(1);
    }
  } catch (err) {
    console.error('Échec de connexion à MongoDB:', err.message);
    process.exit(1);
  }

  demarrerNettoyageAbonnements();
  demarrerRelancesAutomatiques();
  demarrerNettoyageComptesNonConfirmes();
  demarrerReversementsAutomatiques();

  app.listen(PORT, () => {
    console.log(`Serveur Oryxa démarré sur le port ${PORT}`);
  });
}

// On ne démarre le serveur (connexion Mongo + écoute du port) que si ce
// fichier est exécuté directement (`node server.js`), jamais quand il est
// importé — notamment par les tests (voir backend/tests/), qui gèrent leur
// propre connexion à une base MongoDB en mémoire et n'ont pas besoin (et ne
// veulent surtout pas) qu'un vrai serveur écoute un port ou qu'un process.exit
// arrête la suite de tests si MONGO_URI est absent.
if (require.main === module) {
  start();
}

module.exports = app;
