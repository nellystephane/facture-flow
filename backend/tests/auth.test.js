const { connect, closeDatabase, clearDatabase } = require('./setup');
const request = require('supertest');

let app;
let email;

beforeAll(async () => {
  await connect();
  app = require('../server');
  email = require('../utils/email');
});

afterEach(async () => {
  await clearDatabase();
  jest.restoreAllMocks();
});

afterAll(async () => {
  await closeDatabase();
});

const utilisateurValide = {
  nom: 'Awa Test',
  email: 'awa@example.com',
  password: 'MotDePasse1!',
  entreprise: 'Awa Couture',
};

describe('POST /api/auth/register', () => {
  it('refuse un mot de passe trop court', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...utilisateurValide, password: 'Ab1!' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 caractères/);
  });

  it('refuse un mot de passe sans caractère spécial', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...utilisateurValide, password: 'MotDePasse1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/caractère spécial/);
  });

  it('crée le compte, ne connecte pas automatiquement, et envoie un code', async () => {
    const spy = jest.spyOn(email, 'sendVerificationCode').mockResolvedValue(true);
    const res = await request(app).post('/api/auth/register').send(utilisateurValide);
    expect(res.status).toBe(201);
    expect(res.body.needsVerification).toBe(true);
    expect(res.body.token).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].to).toBe(utilisateurValide.email);
  });

  it('refuse un email déjà utilisé', async () => {
    jest.spyOn(email, 'sendVerificationCode').mockResolvedValue(true);
    await request(app).post('/api/auth/register').send(utilisateurValide);
    const res = await request(app).post('/api/auth/register').send(utilisateurValide);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/déjà utilisé/);
  });
});

describe('POST /api/auth/login', () => {
  it('connecte même avant vérification de l’email (pas de blocage de connexion)', async () => {
    jest.spyOn(email, 'sendVerificationCode').mockResolvedValue(true);
    await request(app).post('/api/auth/register').send(utilisateurValide);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: utilisateurValide.email, password: utilisateurValide.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.emailVerifie).toBe(false);
  });

  it('refuse un mauvais mot de passe', async () => {
    jest.spyOn(email, 'sendVerificationCode').mockResolvedValue(true);
    await request(app).post('/api/auth/register').send(utilisateurValide);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: utilisateurValide.email, password: 'MauvaisMotDePasse1!' });
    expect(res.status).toBe(400);
  });
});

describe('Vérification email par code', () => {
  it('valide le compte avec le bon code, refuse un mauvais code', async () => {
    const spy = jest.spyOn(email, 'sendVerificationCode').mockResolvedValue(true);
    await request(app).post('/api/auth/register').send(utilisateurValide);
    const code = spy.mock.calls[0][0].code;

    const mauvais = await request(app)
      .post('/api/auth/verifier-email')
      .send({ email: utilisateurValide.email, code: '000000' });
    expect(mauvais.status).toBe(400);

    const bon = await request(app)
      .post('/api/auth/verifier-email')
      .send({ email: utilisateurValide.email, code });
    expect(bon.status).toBe(200);
    expect(bon.body.token).toBeDefined();
    expect(bon.body.user.emailVerifie).toBe(true);
  });
});

describe('Mot de passe oublié', () => {
  it('permet de réinitialiser le mot de passe avec le bon code', async () => {
    jest.spyOn(email, 'sendVerificationCode').mockResolvedValue(true);
    await request(app).post('/api/auth/register').send(utilisateurValide);

    const spyReset = jest.spyOn(email, 'sendPasswordResetCode').mockResolvedValue(true);
    await request(app).post('/api/auth/mot-de-passe-oublie').send({ email: utilisateurValide.email });
    const code = spyReset.mock.calls[0][0].code;

    const reset = await request(app)
      .post('/api/auth/reinitialiser-mot-de-passe')
      .send({ email: utilisateurValide.email, code, password: 'NouveauMotDePasse1!' });
    expect(reset.status).toBe(200);

    const ancienLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: utilisateurValide.email, password: utilisateurValide.password });
    expect(ancienLogin.status).toBe(400);

    const nouveauLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: utilisateurValide.email, password: 'NouveauMotDePasse1!' });
    expect(nouveauLogin.status).toBe(200);
  });

  it('ne révèle pas si un email existe ou non (message générique)', async () => {
    const res = await request(app)
      .post('/api/auth/mot-de-passe-oublie')
      .send({ email: 'personne-ici@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Si un compte existe/);
  });
});
