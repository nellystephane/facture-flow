const { connect, closeDatabase, clearDatabase } = require('./setup');
const User = require('../models/User');
const { nettoyerAbonnementsExpires } = require('../jobs/cleanExpiredSubscriptions');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function creerUtilisateur(overrides) {
  return User.create({
    nom: 'Test',
    email: `${Date.now()}-${Math.random()}@example.com`,
    password: 'hash-factice',
    emailVerifie: true,
    ...overrides,
  });
}

describe('Nettoyage des abonnements expirés', () => {
  it('repasse en Gratuit un abonnement payant dont la date de fin est passée', async () => {
    const user = await creerUtilisateur({
      subscription: 'pro',
      abonnement: { dateDebut: new Date(Date.now() - 60 * 86400000), dateFin: new Date(Date.now() - 86400000) },
    });
    const n = await nettoyerAbonnementsExpires();
    expect(n).toBe(1);
    const reload = await User.findById(user._id);
    expect(reload.subscription).toBe('gratuit');
  });

  it("ne touche pas un abonnement payant encore actif", async () => {
    const user = await creerUtilisateur({
      subscription: 'business',
      abonnement: { dateDebut: new Date(), dateFin: new Date(Date.now() + 30 * 86400000) },
    });
    await nettoyerAbonnementsExpires();
    const reload = await User.findById(user._id);
    expect(reload.subscription).toBe('business');
  });

  it('ne touche pas les comptes déjà en Gratuit', async () => {
    await creerUtilisateur({ subscription: 'gratuit' });
    const n = await nettoyerAbonnementsExpires();
    expect(n).toBe(0);
  });
});
