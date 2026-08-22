const request = require('supertest');

let seq = 0;

// Crée un compte, le connecte (login ne nécessite pas la vérification email
// — voir tests/auth.test.js) et renvoie le token + l'id utilisateur.
async function creerUtilisateurConnecte(app, overrides = {}) {
  seq += 1;
  const data = {
    nom: 'Test User',
    email: `user${seq}-${Date.now()}@example.com`,
    password: 'MotDePasse1!',
    entreprise: 'Test SARL',
    ...overrides,
  };
  await request(app).post('/api/auth/register').send(data);
  const login = await request(app).post('/api/auth/login').send({ email: data.email, password: data.password });
  return { token: login.body.token, userId: login.body.user.id, email: data.email };
}

async function creerClient(app, token, overrides = {}) {
  const res = await request(app)
    .post('/api/clients')
    .set('Authorization', `Bearer ${token}`)
    .send({ nom: 'Client Test', email: 'client@example.com', ...overrides });
  return res.body;
}

// Fait passer un compte en Pro/Business directement en base — on ne simule
// pas tout le flux FedaPay dans les tests, mais on peut vérifier que les
// permissions réagissent correctement une fois l'abonnement actif.
async function passerAuPlanPayant(User, userId, plan = 'pro', joursValidite = 180) {
  await User.findByIdAndUpdate(userId, {
    subscription: plan,
    abonnement: {
      duree: '6mois',
      dateDebut: new Date(),
      dateFin: new Date(Date.now() + joursValidite * 86400000),
    },
  });
}

module.exports = { creerUtilisateurConnecte, creerClient, passerAuPlanPayant };
