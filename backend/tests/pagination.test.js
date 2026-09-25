const { connect, closeDatabase, clearDatabase } = require('./setup');
const request = require('supertest');
const { creerUtilisateurConnecte } = require('./helpers');

let app;

beforeAll(async () => {
  await connect();
  app = require('../server');
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Pagination des listes', () => {
  it('pagine les clients avec la forme {items, page, limit, total, totalPages}', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    for (let i = 0; i < 25; i++) {
      await request(app).post('/api/clients').set('Authorization', `Bearer ${token}`).send({ nom: `Client ${i}` });
    }

    const page1 = await request(app).get('/api/clients?limit=10&page=1').set('Authorization', `Bearer ${token}`);
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(10);
    expect(page1.body.total).toBe(25);
    expect(page1.body.totalPages).toBe(3);
    expect(page1.body.page).toBe(1);

    const page3 = await request(app).get('/api/clients?limit=10&page=3').set('Authorization', `Bearer ${token}`);
    expect(page3.body.items).toHaveLength(5);
  });

  it('filtre par recherche (q) côté serveur', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    await request(app).post('/api/clients').set('Authorization', `Bearer ${token}`).send({ nom: 'Awa Couture' });
    await request(app).post('/api/clients').set('Authorization', `Bearer ${token}`).send({ nom: 'Moussa Bâtiment' });

    const res = await request(app).get('/api/clients?q=awa').set('Authorization', `Bearer ${token}`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].nom).toBe('Awa Couture');
  });

  it('plafonne la limite à 100 et impose au moins 1', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const res = await request(app).get('/api/clients?limit=99999&page=0').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
    expect(res.body.page).toBe(1);
  });
});
