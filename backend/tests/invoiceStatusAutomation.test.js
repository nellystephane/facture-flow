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

function facturePayload(clientId) {
  return {
    client: clientId,
    objet: 'Prestation',
    items: [{ description: 'Service', quantite: 1, prixUnitaire: 10000 }],
  };
}

describe('Statuts de facture automatiques', () => {
  it('ignore un statut envoyé à la création (toujours brouillon au départ)', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...facturePayload(client._id), statut: 'payee' });
    expect(res.status).toBe(201);
    expect(res.body.statut).toBe('brouillon');
  });

  it('permet d’annuler une facture non payée', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const f = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send(facturePayload(client._id));

    const res = await request(app)
      .patch(`/api/invoices/${f.body._id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'annulee' });
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('annulee');
  });

  it('refuse d’annuler une facture déjà payée', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const f = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send(facturePayload(client._id));
    const Invoice = require('../models/Invoice');
    await Invoice.findByIdAndUpdate(f.body._id, { statut: 'payee' });

    const res = await request(app)
      .patch(`/api/invoices/${f.body._id}/statut`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statut: 'annulee' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVOICE_NOT_CANCELLABLE');
  });

  it('refuse toute autre valeur que "annulee" sur le changement manuel de statut', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const f = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send(facturePayload(client._id));

    for (const statut of ['envoyee', 'vue', 'payee', 'en_retard']) {
      const res = await request(app)
        .patch(`/api/invoices/${f.body._id}/statut`)
        .set('Authorization', `Bearer ${token}`)
        .send({ statut });
      expect(res.status).toBe(400);
    }
  });

  it("l'envoi réel par email est ce qui fait passer une facture en \"Envoyée\" (pas un choix manuel)", async () => {
    const email = require('../utils/email');
    jest.spyOn(email, 'sendInvoiceEmail').mockResolvedValue(true);

    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token, { email: 'client@example.com' });
    const f = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send(facturePayload(client._id));
    expect(f.body.statut).toBe('brouillon');

    const envoi = await request(app)
      .post(`/api/invoices/${f.body._id}/envoyer`)
      .set('Authorization', `Bearer ${token}`);
    expect(envoi.status).toBe(200);
    expect(envoi.body.invoice.statut).toBe('envoyee');
    expect(email.sendInvoiceEmail).toHaveBeenCalledTimes(1);

    jest.restoreAllMocks();
  });
});
