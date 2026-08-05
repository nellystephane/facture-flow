require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const statsRoutes = require('./routes/statsRoutes');
const publicRoutes = require('./routes/publicRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());

const allowedOrigins = (process.env.CLIENT_URL || 'https://nellystephane.github.io/facture-flow')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// Normalise une origine en ne gardant que protocole + hôte + port (sans chemin).
// Le navigateur n'envoie jamais le chemin dans l'en-tête Origin (ex. une URL
// déployée sur GitHub Pages envoie "https://nellystephane.github.io" même si
// l'app tourne sous "/facture-flow"). Comparer sur la seule base permet de
// tolérer que CLIENT_URL contienne ou non le chemin.
const normalizeOrigin = (o) => {
  try {
    const u = new URL(o);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return o.toLowerCase().replace(/\/+$/, '');
  }
};

const allowedOriginsBase = allowedOrigins.map(normalizeOrigin);

console.log('CORS — origines autorisées :', allowedOrigins);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // requêtes sans origine (curl, health check…)
    if (allowedOriginsBase.includes(normalizeOrigin(origin))) return callback(null, true);
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

app.use((req, res) => {
  res.status(404).json({ message: 'Ressource introuvable' });
});

// Gestionnaire d'erreurs global (filet de sécurité)
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  res.status(err.status || 500).json({ message: err.message || 'Erreur serveur' });
});

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

  app.listen(PORT, () => {
    console.log(`Serveur FactuFlow démarré sur le port ${PORT}`);
  });
}

start();

module.exports = app;
