require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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

const app = express();

app.set('trust proxy', 1);
app.use(helmet());

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

console.log('CORS — origines autorisées :', allowedOrigins);

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
});
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives, réessayez plus tard.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/verifier-email', authLimiter);
app.use('/api/auth/renvoyer-code', authLimiter);
app.use('/api/auth/mot-de-passe-oublie', authLimiter);
app.use('/api/auth/reinitialiser-mot-de-passe', authLimiter);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? 'connecté' : 'déconnecté',
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
  res.status(err.status || 500).json({ message: err.message || 'Erreur serveur' });
});

const { demarrerNettoyageAbonnements } = require('./jobs/cleanExpiredSubscriptions');
const { demarrerRelancesAutomatiques } = require('./jobs/paymentReminders');

const PORT = process.env.PORT || 5000;

async function start() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI manquant dans les variables d'environnement.");
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connecté');
  } catch (err) {
    console.error('Échec de connexion à MongoDB:', err.message);
    process.exit(1);
  }

  demarrerNettoyageAbonnements();
  demarrerRelancesAutomatiques();

  app.listen(PORT, () => {
    console.log(`Serveur FactuFlow démarré sur le port ${PORT}`);
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
