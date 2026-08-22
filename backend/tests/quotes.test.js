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

function devisPayload(clientId, overrides = {}) {
  return {
    client: clientId,
    objet: 'Devis de test',
    items: [{ description: 'Conception', quantite: 1, prixUnitaire: 100000 }],
    tva: 18,
    ...overrides,
  };
}

describe('Numérotation des devis', () => {
  it('génère des numéros séquentiels et ignore un numero fourni par le client', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);

    const d1 = await request(app)
      .post('/api/quotes')
      .set('Authorization', `Bearer ${token}`)
      .send(devisPayload(client._id, { numero: 'DEV-2099-9999' }));
    expect(d1.status).toBe(201);
    expect(d1.body.numero).toMatch(/^DEV-\d{4}-0001$/);

    const d2 = await request(app)
      .post('/api/quotes')
      .set('Authorization', `Bearer ${token}`)
      .send(devisPayload(client._id));
    expect(d2.body.numero).toMatch(/^DEV-\d{4}-0002$/);
  });

  it('la séquence des devis est indépendante de celle des factures', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);

    const facture = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send({
      client: client._id,
      items: [{ description: 'X', quantite: 1, prixUnitaire: 1000 }],
    });
    const devis = await request(app).post('/api/quotes').set('Authorization', `Bearer ${token}`).send(devisPayload(client._id));

    expect(facture.body.numero).toMatch(/^FAC-\d{4}-0001$/);
    expect(devis.body.numero).toMatch(/^DEV-\d{4}-0001$/);
  });
});

describe('Immutabilité des devis acceptés', () => {
  it('autorise la modification tant que le devis n’est pas accepté', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const d = await request(app).post('/api/quotes').set('Authorization', `Bearer ${token}`).send(devisPayload(client._id));

    const maj = await request(app)
      .put(`/api/quotes/${d.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ objet: 'Objet modifié' });
    expect(maj.status).toBe(200);
  });

  it('bloque la modification et la suppression une fois le devis accepté', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const d = await request(app).post('/api/quotes').set('Authorization', `Bearer ${token}`).send(devisPayload(client._id));

    await request(app)
      .patch(`/api/quotes/${d.body._id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'accepte' });

    const maj = await request(app)
      .put(`/api/quotes/${d.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ objet: 'Tentative de modification' });
    expect(maj.status).toBe(409);
    expect(maj.body.code).toBe('QUOTE_NOT_EDITABLE');

    const suppr = await request(app).delete(`/api/quotes/${d.body._id}`).set('Authorization', `Bearer ${token}`);
    expect(suppr.status).toBe(409);
    expect(suppr.body.code).toBe('QUOTE_NOT_DELETABLE');
  });
});
