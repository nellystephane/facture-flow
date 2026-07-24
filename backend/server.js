require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dns = require('dns');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const clientRoutes = require('./routes/clientRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const statsRoutes = require('./routes/statsRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();

// Nécessaire derrière un proxy (Render, Railway, Vercel...) pour que le
// rate-limiter et req.ip fonctionnent correctement.
app.set('trust proxy', 1);

// En-têtes de sécurité de base
app.use(helmet());

// CORS configurable — CLIENT_URL peut contenir plusieurs origines séparées
// par des virgules (utile pour un environnement de prévisualisation + prod).
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Anti brute-force sur les routes d'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives, réessayez dans quelques minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Healthcheck — inclut l'état réel de la connexion MongoDB
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connecté
  res.json({
    status: 'ok',
    service: 'factuflow',
    db: dbState === 1 ? 'connected' : 'disconnected',
  });
});

// Routes publiques (aucune authentification, aucune dépendance stricte à la DB)
app.use('/api/public', publicRoutes);

// Garde-fou : si la base n'est pas connectée, on répond clairement plutôt
// que de laisser les requêtes s'éterniser ou échouer avec une erreur obscure.
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: "Le service est temporairement indisponible (base de données non connectée). Réessayez dans un instant.",
    });
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/stats', statsRoutes);

// 404
app.use((req, res) => res.status(404).json({ message: 'Route introuvable' }));

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  res.status(err.status || 500).json({ message: err.message || 'Erreur serveur' });
});

const PORT = process.env.PORT || 5000;

// Forcer les DNS publics (Atlas parfois capricieux en local)
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (_) {}

mongoose.set('strictQuery', true);

mongoose.connection.on('connected', () => console.log('✓ MongoDB connecté'));
mongoose.connection.on('error', (err) => console.error('✗ Erreur MongoDB:', err.message));
mongoose.connection.on('disconnected', () => console.warn('⚠ MongoDB déconnecté'));

if (!process.env.MONGO_URI) {
  console.error('✗ MONGO_URI manquant dans le fichier .env — voir .env.example.');
}

mongoose.connect(process.env.MONGO_URI || '')
  .catch((err) => {
    console.error('✗ Connexion MongoDB impossible au démarrage:', err.message);
    console.error('  Vérifiez MONGO_URI dans backend/.env (identifiants Atlas, IP autorisée, etc.)');
  });

// Le serveur démarre dans tous les cas pour exposer /api/health et /api/public,
// mais toute route protégée renverra une 503 tant que MongoDB n'est pas connecté.
app.listen(PORT, () => console.log(`✓ Serveur FactuFlow démarré sur le port ${PORT}`));
