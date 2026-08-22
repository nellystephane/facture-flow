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

describe('Validation — clients', () => {
  it('refuse un client sans nom', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const res = await request(app).post('/api/clients').set('Authorization', `Bearer ${token}`).send({ email: 'x@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('refuse un email client mal formé', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const res = await request(app).post('/api/clients').set('Authorization', `Bearer ${token}`).send({ nom: 'Client X', email: 'pas-un-email' });
    expect(res.status).toBe(400);
  });

  it('accepte un client valide et ignore silencieusement un champ inconnu', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Client Valide', champInconnu: 'ignoré' });
    expect(res.status).toBe(201);
    expect(res.body.champInconnu).toBeUndefined();
  });
});

describe('Validation — factures', () => {
  it("refuse une facture avec un identifiant client mal formé", async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: 'pas-un-id', items: [{ description: 'X', quantite: 1, prixUnitaire: 100 }] });
    expect(res.status).toBe(400);
  });

  it('refuse une facture sans aucun article', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client._id, items: [] });
    expect(res.status).toBe(400);
  });

  it('refuse un prix unitaire négatif', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client._id, items: [{ description: 'X', quantite: 1, prixUnitaire: -50 }] });
    expect(res.status).toBe(400);
  });

  it('refuse une quantité nulle ou négative', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client._id, items: [{ description: 'X', quantite: 0, prixUnitaire: 100 }] });
    expect(res.status).toBe(400);
  });

  it('refuse une TVA supérieure à 100%', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client._id, items: [{ description: 'X', quantite: 1, prixUnitaire: 100 }], tva: 150 });
    expect(res.status).toBe(400);
  });

  it('refuse un statut invalide sur le changement de statut', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const facture = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client._id, items: [{ description: 'X', quantite: 1, prixUnitaire: 100 }] });
    const res = await request(app)
      .patch(`/api/invoices/${facture.body._id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'statut_qui_nexiste_pas' });
    expect(res.status).toBe(400);
  });
});

describe('Validation — paiements', () => {
  it('refuse un paiement avec un montant négatif ou nul', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const facture = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client._id, items: [{ description: 'X', quantite: 1, prixUnitaire: 100 }] });

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoice: facture.body._id, montant: 0 });
    expect(res.status).toBe(400);
  });

  it('refuse une méthode de paiement inconnue', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const facture = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client._id, items: [{ description: 'X', quantite: 1, prixUnitaire: 100 }] });

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoice: facture.body._id, montant: 100, methode: 'bitcoin' });
    expect(res.status).toBe(400);
  });
});

describe('Validation — profil', () => {
  it('refuse un logo qui n\'est pas une image en base64', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const res = await request(app)
      .post('/api/auth/profile/logo')
      .set('Authorization', `Bearer ${token}`)
      .send({ logoBase64: 'pas-une-image' });
    expect(res.status).toBe(400);
  });

  it('refuse un logo trop volumineux', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    // ~1.3 Mo décodé une fois la chaîne base64 générée, au-delà de la limite de 900 Ko.
    const grosBuffer = Buffer.alloc(1_300_000, 1);
    const res = await request(app)
      .post('/api/auth/profile/logo')
      .set('Authorization', `Bearer ${token}`)
      .send({ logoBase64: `data:image/png;base64,${grosBuffer.toString('base64')}` });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/trop lourde/);
  });

  it('accepte un logo PNG valide et permet de le retirer ensuite', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    // 1x1 PNG transparent valide (quelques dizaines d'octets)
    const petitPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const up = await request(app)
      .post('/api/auth/profile/logo')
      .set('Authorization', `Bearer ${token}`)
      .send({ logoBase64: `data:image/png;base64,${petitPng}` });
    expect(up.status).toBe(200);
    expect(up.body.logoUrl).toContain('data:image/png;base64,');

    const del = await request(app).delete('/api/auth/profile/logo').set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(del.body.logoUrl).toBe('');
  });

  it('accepte une mise à jour partielle sans exiger tous les champs', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ telephone: '+229 00000000' });
    expect(res.status).toBe(200);
    expect(res.body.telephone).toBe('+229 00000000');
  });
});
