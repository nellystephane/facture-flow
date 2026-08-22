const { connect, closeDatabase, clearDatabase } = require('./setup');
const request = require('supertest');
const { creerUtilisateurConnecte, creerClient } = require('./helpers');

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

function facturePayload(clientId, overrides = {}) {
  return {
    client: clientId,
    objet: 'Prestation de test',
    items: [{ description: 'Développement', quantite: 2, prixUnitaire: 50000 }],
    tva: 18,
    ...overrides,
  };
}

describe('Numérotation des factures', () => {
  it('génère des numéros séquentiels et ignore un numero fourni par le client (anti-falsification)', async () => {
    const { token, userId } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);

    const f1 = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(facturePayload(client._id, { numero: 'FAC-2099-9999' })); // tentative de falsification
    expect(f1.status).toBe(201);
    expect(f1.body.numero).not.toBe('FAC-2099-9999');
    expect(f1.body.numero).toMatch(/^FAC-\d{4}-0001$/);

    const f2 = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(facturePayload(client._id));
    expect(f2.body.numero).toMatch(/^FAC-\d{4}-0002$/);

    // Un numéro n'est jamais réutilisé, même après suppression du brouillon.
    await request(app).delete(`/api/invoices/${f2.body._id}`).set('Authorization', `Bearer ${token}`);
    const f3 = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(facturePayload(client._id));
    expect(f3.body.numero).toMatch(/^FAC-\d{4}-0003$/);
    void userId;
  });

  it('attribue des numéros uniques même sur des créations simultanées (atomicité)', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);

    const creations = Array.from({ length: 5 }).map(() =>
      request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send(facturePayload(client._id))
    );
    const resultats = await Promise.all(creations);
    const numeros = resultats.map((r) => r.body.numero);
    expect(new Set(numeros).size).toBe(5); // aucun doublon
  });

  it('les compteurs de deux comptes différents sont indépendants', async () => {
    const u1 = await creerUtilisateurConnecte(app);
    const u2 = await creerUtilisateurConnecte(app);
    const c1 = await creerClient(app, u1.token);
    const c2 = await creerClient(app, u2.token);

    const f1 = await request(app).post('/api/invoices').set('Authorization', `Bearer ${u1.token}`).send(facturePayload(c1._id));
    const f2 = await request(app).post('/api/invoices').set('Authorization', `Bearer ${u2.token}`).send(facturePayload(c2._id));
    expect(f1.body.numero).toMatch(/-0001$/);
    expect(f2.body.numero).toMatch(/-0001$/); // repart à 1 pour chaque compte
  });
});

describe('Limite du plan Gratuit (10 factures/mois)', () => {
  it('bloque la 11e facture du mois avec un message explicite', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);

    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send(facturePayload(client._id));
      expect(res.status).toBe(201);
    }

    const onzieme = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send(facturePayload(client._id));
    expect(onzieme.status).toBe(403);
    expect(onzieme.body.code).toBe('FREE_LIMIT_REACHED');
  }, 20000);
});

describe('Immutabilité des factures envoyées', () => {
  it('autorise la modification et la suppression tant que la facture est en brouillon', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const f = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send(facturePayload(client._id));

    const maj = await request(app)
      .put(`/api/invoices/${f.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ objet: 'Objet modifié' });
    expect(maj.status).toBe(200);
    expect(maj.body.objet).toBe('Objet modifié');

    const suppr = await request(app).delete(`/api/invoices/${f.body._id}`).set('Authorization', `Bearer ${token}`);
    expect(suppr.status).toBe(200);
  });

  it("bloque la modification et la suppression dès que la facture n'est plus un brouillon", async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const f = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send(facturePayload(client._id));

    await request(app)
      .patch(`/api/invoices/${f.body._id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'envoyee' });

    const maj = await request(app)
      .put(`/api/invoices/${f.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ objet: 'Tentative de modification' });
    expect(maj.status).toBe(409);
    expect(maj.body.code).toBe('INVOICE_NOT_EDITABLE');

    const suppr = await request(app).delete(`/api/invoices/${f.body._id}`).set('Authorization', `Bearer ${token}`);
    expect(suppr.status).toBe(409);
    expect(suppr.body.code).toBe('INVOICE_NOT_DELETABLE');
  });
});
