const { connect, closeDatabase, clearDatabase } = require('./setup');
const User = require('../models/User');
const { nettoyerComptesNonConfirmes } = require('../jobs/cleanUnverifiedAccounts');

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
  const user = await User.create({
    nom: 'Test',
    email: `${Date.now()}-${Math.random()}@example.com`,
    password: 'hash-factice',
    emailVerifie: false,
    ...overrides,
  });
  return user;
}

describe('Nettoyage des comptes jamais confirmés', () => {
  it('supprime un compte non confirmé créé il y a plus de 24h', async () => {
    const user = await creerUtilisateur({});
    await User.updateOne({ _id: user._id }, { createdAt: new Date(Date.now() - 25 * 3600000) });

    const n = await nettoyerComptesNonConfirmes();
    expect(n).toBe(1);
    expect(await User.findById(user._id)).toBeNull();
  });

  it('ne touche pas un compte non confirmé encore récent', async () => {
    const user = await creerUtilisateur({});
    const n = await nettoyerComptesNonConfirmes();
    expect(n).toBe(0);
    expect(await User.findById(user._id)).not.toBeNull();
  });

  it('ne touche jamais un compte déjà confirmé, même ancien', async () => {
    const user = await creerUtilisateur({ emailVerifie: true });
    await User.updateOne({ _id: user._id }, { createdAt: new Date(Date.now() - 48 * 3600000) });

    const n = await nettoyerComptesNonConfirmes();
    expect(n).toBe(0);
    expect(await User.findById(user._id)).not.toBeNull();
  });
});
