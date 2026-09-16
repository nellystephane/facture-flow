// Utilitaires partagés par tous les fichiers de tests : démarre une
// instance MongoDB en mémoire (aucune base réelle requise, fonctionne en
// CI comme en local sans configuration), connecte mongoose dessus, et
// fournit un moyen de vider les collections entre deux tests pour qu'ils
// restent indépendants les uns des autres.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-de-test-ne-jamais-utiliser-en-prod';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
// Volontairement PAS de BREVO_SMTP_*/FEDAPAY_* ici : les tests doivent
// passer même sans ces intégrations configurées (voir utils/email.js et
// utils/fedapay.js, qui échouent proprement plutôt que de planter).

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

async function connect() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function closeDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
}

async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

module.exports = { connect, closeDatabase, clearDatabase };
