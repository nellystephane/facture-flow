const { connect, closeDatabase, clearDatabase } = require('./setup');
const request = require('supertest');
const { creerUtilisateurConnecte, creerClient, passerAuPlanPayant } = require('./helpers');

let app;
let User;

beforeAll(async () => {
  await connect();
  app = require('../server');
  User = require('../models/User');
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Scénario : utilisateur Gratuit', () => {
  it('ne peut pas utiliser la facturation express', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const service = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Développement site', prix: 100000 });

    const res = await request(app)
      .post('/api/invoices/from-service')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: service.body._id, clientId: client._id });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FEATURE_LOCKED');
    expect(res.body.feature).toBe('facturationExpress');
  });

  it("ne voit pas les statistiques avancées sur le tableau de bord", async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const res = await request(app).get('/api/stats/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.statistiquesAvancees).toBe(false);
    expect(res.body.revenusMensuels).toBeUndefined();
    expect(res.body.topClients).toBeUndefined();
  });

  it("ne peut pas exporter la comptabilité", async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const res = await request(app).get('/api/invoices/export').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.feature).toBe('exportComptable');
  });

  it("ne peut pas enregistrer une facture avec un modèle payant (retombe sur 'classique')", async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client._id, items: [{ description: 'X', quantite: 1, prixUnitaire: 100 }], template: 'moderne' });
    expect(res.status).toBe(201);
    expect(res.body.template).toBe('classique');
  });
});

describe('Scénario : tentative de contournement frontend', () => {
  it("modifier son profil n'accorde jamais un abonnement payant (le champ n'est pas dans la liste autorisée)", async () => {
    const { token, userId } = await creerUtilisateurConnecte(app);
    await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscription: 'business', estPremium: true }); // tentative de falsification

    const user = await User.findById(userId);
    expect(user.subscription).toBe('gratuit');
  });

  it('la 11e facture est bloquée même si le frontend a laissé passer les 10 premières', async () => {
    const { token } = await creerUtilisateurConnecte(app);
    const client = await creerClient(app, token);
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send({
        client: client._id, items: [{ description: 'X', quantite: 1, prixUnitaire: 100 }],
      });
    }
    const res = await request(app).post('/api/invoices').set('Authorization', `Bearer ${token}`).send({
      client: client._id, items: [{ description: 'X', quantite: 1, prixUnitaire: 100 }],
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FREE_LIMIT_REACHED');
  }, 20000);
});

describe('Scénario : utilisateur Pro', () => {
  it('débloque la facturation express, les modèles payants, l’export et les stats avancées', async () => {
    const { token, userId } = await creerUtilisateurConnecte(app);
    await passerAuPlanPayant(User, userId, 'pro');
    const client = await creerClient(app, token);
    const service = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Développement site', prix: 100000 });

    const facture = await request(app)
      .post('/api/invoices/from-service')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: service.body._id, clientId: client._id });
    expect(facture.status).toBe(201);

    const avecModele = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ client: client._id, items: [{ description: 'X', quantite: 1, prixUnitaire: 100 }], template: 'moderne' });
    expect(avecModele.body.template).toBe('moderne');

    const exportRes = await request(app).get('/api/invoices/export').set('Authorization', `Bearer ${token}`);
    expect(exportRes.status).toBe(200);

    const dashboard = await request(app).get('/api/stats/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.body.statistiquesAvancees).toBe(true);
    expect(Array.isArray(dashboard.body.revenusMensuels)).toBe(true);
  });

  it("n'a pas accès à la gestion d'équipe (réservée à Business)", async () => {
    const { token, userId } = await creerUtilisateurConnecte(app);
    await passerAuPlanPayant(User, userId, 'pro');
    const res = await request(app)
      .post('/api/team/inviter')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Collègue', email: 'collegue@example.com', role: 'collaborateur' });
    expect(res.status).toBe(403);
    expect(res.body.feature).toBe('multiUtilisateurs');
  });
});

describe('Scénario : expiration d’abonnement', () => {
  it('un abonnement Pro expiré perd immédiatement ses avantages, sans attendre le job de nettoyage', async () => {
    const { token, userId } = await creerUtilisateurConnecte(app);
    // Abonnement Pro dont la date de fin est dans le passé
    await User.findByIdAndUpdate(userId, {
      subscription: 'pro',
      abonnement: { duree: '6mois', dateDebut: new Date(Date.now() - 200 * 86400000), dateFin: new Date(Date.now() - 1000) },
    });

    const client = await creerClient(app, token);
    const service = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'X', prix: 1000 });

    const res = await request(app)
      .post('/api/invoices/from-service')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: service.body._id, clientId: client._id });
    expect(res.status).toBe(403); // redevient Gratuit immédiatement (voir config/plans.js planEffectifDe)
  });
});

describe('Scénario : Business — équipe et isolation des données', () => {
  async function creerCompteBusinessAvecMembre() {
    const proprio = await creerUtilisateurConnecte(app);
    await passerAuPlanPayant(User, proprio.userId, 'business');

    const invitation = await request(app)
      .post('/api/team/inviter')
      .set('Authorization', `Bearer ${proprio.token}`)
      .send({ nom: 'Collègue', email: `collegue-${Date.now()}@example.com`, role: 'collaborateur' });
    expect(invitation.status).toBe(201);

    // Le membre invité définit son mot de passe via le code envoyé par email —
    // on récupère le code directement en base pour le test (pas d'accès à
    // la boîte mail réelle ici).
    const membreDoc = await User.findById(invitation.body.membre.id).select('+codeResetPassword +codeResetPasswordExpire email');
    return { proprio, membreEmail: membreDoc.email, membreId: invitation.body.membre.id };
  }

  it("un collaborateur voit et modifie les données de l'espace du propriétaire, pas les siennes propres", async () => {
    const { proprio, membreId } = await creerCompteBusinessAvecMembre();

    // Le propriétaire crée un client dans son espace
    const client = await creerClient(app, proprio.token, { nom: 'Client du propriétaire' });

    // On simule la connexion du membre en générant directement un token
    // (équivalent à ce que /reinitialiser-mot-de-passe renverrait)
    const jwt = require('jsonwebtoken');
    const membreToken = jwt.sign({ id: membreId }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const vuParMembre = await request(app).get('/api/clients').set('Authorization', `Bearer ${membreToken}`);
    expect(vuParMembre.status).toBe(200);
    expect(vuParMembre.body.items.some((c) => c._id === client._id)).toBe(true);

    const factureParMembre = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${membreToken}`)
      .send({ client: client._id, items: [{ description: 'Prestation', quantite: 1, prixUnitaire: 5000 }] });
    expect(factureParMembre.status).toBe(201);

    // La facture doit appartenir au PROPRIÉTAIRE, pas au collaborateur
    const Invoice = require('../models/Invoice');
    const factureEnBase = await Invoice.findById(factureParMembre.body._id);
    expect(String(factureEnBase.owner)).toBe(String(proprio.userId));
  });

  it("un compte totalement étranger ne voit jamais les données d'un autre espace de travail", async () => {
    const { proprio } = await creerCompteBusinessAvecMembre();
    const client = await creerClient(app, proprio.token, { nom: 'Client confidentiel' });

    const etranger = await creerUtilisateurConnecte(app);
    const res = await request(app).get(`/api/clients/${client._id}`).set('Authorization', `Bearer ${etranger.token}`);
    expect(res.status).toBe(404); // jamais un 200 avec les données d'un autre compte
  });

  it('un collaborateur ne peut pas gérer l’équipe ni l’abonnement (réservé propriétaire/admin)', async () => {
    const { membreId } = await creerCompteBusinessAvecMembre();
    const jwt = require('jsonwebtoken');
    const membreToken = jwt.sign({ id: membreId }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const inviter = await request(app)
      .post('/api/team/inviter')
      .set('Authorization', `Bearer ${membreToken}`)
      .send({ nom: 'Autre', email: 'autre@example.com', role: 'collaborateur' });
    expect(inviter.status).toBe(403);
    expect(inviter.body.code).toBe('ROLE_INSUFFISANT');

    const abonnement = await request(app)
      .post('/api/subscription/subscribe')
      .set('Authorization', `Bearer ${membreToken}`)
      .send({ plan: 'pro', duree: '1an' });
    expect(abonnement.status).toBe(403);
  });

  it('le propriétaire peut retirer un membre, qui perd immédiatement l’accès', async () => {
    const { proprio, membreId } = await creerCompteBusinessAvecMembre();
    const jwt = require('jsonwebtoken');
    const membreToken = jwt.sign({ id: membreId }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const avantRetrait = await request(app).get('/api/clients').set('Authorization', `Bearer ${membreToken}`);
    expect(avantRetrait.status).toBe(200);

    const retrait = await request(app).delete(`/api/team/${membreId}`).set('Authorization', `Bearer ${proprio.token}`);
    expect(retrait.status).toBe(200);

    const apresRetrait = await request(app).get('/api/clients').set('Authorization', `Bearer ${membreToken}`);
    expect(apresRetrait.status).toBe(401); // le compte n'existe plus, le token ne vaut plus rien
  });
});
