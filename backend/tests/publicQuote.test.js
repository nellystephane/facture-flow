const { connect, closeDatabase, clearDatabase } = require('./setup');
const request = require('supertest');
const { creerUtilisateurConnecte, creerClient } = require('./helpers');

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

async function creerDevis(token, clientId) {
  const res = await request(app)
    .post('/api/quotes')
    .set('Authorization', `Bearer ${token}`)
    .send({
      client: clientId,
      objet: 'Devis public test',
      items: [{ description: 'Prestation', quantite: 1, prixUnitaire: 75000 }],
      tva: 18,
    });
  return res.body;
}

describe('Page publique de devis', () => {
  it('le client peut consulter le devis via son lien public sans compte', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const devis = await creerDevis(token, client._id);

    const res = await request(app).get(`/api/public/quotes/${devis.publicToken}`);
    expect(res.status).toBe(200);
    expect(res.body.quote.numero).toBe(devis.numero);
    expect(res.body.totalTTC).toBeGreaterThan(0);
  });

  it("l'acceptation génère automatiquement une facture brouillon liée et notifie le prestataire", async () => {
    jest.spyOn(email, 'sendQuoteAccepteeNotification').mockResolvedValue(true);
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const devis = await creerDevis(token, client._id);

    const res = await request(app)
      .post(`/api/public/quotes/${devis.publicToken}/repondre`)
      .send({ action: 'accepter' });
    expect(res.status).toBe(200);
    expect(res.body.quote.statut).toBe('accepte');
    expect(res.body.quote.invoiceGeneree).toBeTruthy();

    const facture = await request(app)
      .get(`/api/invoices/${res.body.quote.invoiceGeneree}`)
      .set('Authorization', `Bearer ${token}`);
    expect(facture.status).toBe(200);
    expect(facture.body.statut).toBe('brouillon'); // jamais envoyée automatiquement
    expect(facture.body.quote).toBe(devis._id);

    expect(email.sendQuoteAccepteeNotification).toHaveBeenCalledTimes(1);
  });

  it('une demande d’infos enregistre le message et notifie le prestataire, sans changer le statut', async () => {
    jest.spyOn(email, 'sendQuoteInfoRequestNotification').mockResolvedValue(true);
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const devis = await creerDevis(token, client._id);

    const res = await request(app)
      .post(`/api/public/quotes/${devis.publicToken}/repondre`)
      .send({ action: 'demander_infos', message: 'Le tarif inclut-il le déplacement ?' });
    expect(res.status).toBe(200);
    expect(res.body.quote.statut).toBe('brouillon');
    expect(res.body.quote.demandeInfo.message).toMatch(/déplacement/);
    expect(email.sendQuoteInfoRequestNotification).toHaveBeenCalledTimes(1);
  });

  it('refuse une deuxième acceptation une fois le devis déjà accepté', async () => {
    jest.spyOn(email, 'sendQuoteAccepteeNotification').mockResolvedValue(true);
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const devis = await creerDevis(token, client._id);

    await request(app).post(`/api/public/quotes/${devis.publicToken}/repondre`).send({ action: 'accepter' });
    const deuxieme = await request(app).post(`/api/public/quotes/${devis.publicToken}/repondre`).send({ action: 'accepter' });
    expect(deuxieme.status).toBe(409);
  });
});
