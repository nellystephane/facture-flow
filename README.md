# ⚡ FactuFlow

**La plateforme de facturation et de gestion pensée pour les freelances, artisans et PME d'Afrique francophone.**

Créez devis et factures en quelques secondes, suivez les paiements Mobile Money, générez des PDF professionnels et pilotez votre activité depuis un tableau de bord clair — tout en FCFA.

---

## ✨ Fonctionnalités

### MVP (v1) — Inclus
- 📊 **Tableau de bord** — chiffre d'affaires, factures payées / en attente / en retard, top clients, revenus mensuels
- 👥 **Clients** — carnet complet (nom, entreprise, contact, adresse, notes)
- 📦 **Produits & Services** — catalogue réutilisable avec prix unitaires
- 🧾 **Devis** — création, suivi, statuts, transformation en facture en un clic
- 📄 **Factures** — numérotation automatique, statuts (brouillon, envoyée, vue, payée, en retard, annulée)
- 💳 **Paiements** — espèces, MTN Money, Moov Money, carte, virement ; passage auto au statut "payée"
- 🖥️ **PDF** — génération d'un PDF professionnel pour factures et devis
- 🔍 **Historique & recherche** — par client, date, statut

### Évolutions prévues (v2 / v3)
- ✍️ Signature électronique des devis
- 🔔 Relances automatiques (J+7, J+15, J+30)
- 📱 Envoi WhatsApp avec PDF
- 🤖 Génération de factures par IA
- 💰 Gestion des dépenses & bénéfices
- 👥 Gestion d'équipe multi-rôles

---

## 🎨 Design

- **Thème** : blanc dégradé + effet **liquid glass**
- **Couleurs** : rouge (`#e11d2a`) & noir (`#0a0a0c`)
- **Icônes** : [Lucide React](https://lucide.dev)
- **Animations** : fondu, glissement, orbes flottants, transitions fluides

---

## 🛠️ Stack technique

| Couche        | Technologie                          |
|---------------|--------------------------------------|
| Frontend      | React 19 + TypeScript + Vite         |
| Styles        | Tailwind CSS v4                      |
| Icônes        | Lucide React                         |
| Routing       | React Router v7                      |
| Backend       | Node.js + Express 5                  |
| Base de données | MongoDB Atlas (Mongoose)           |
| Authentification | JWT (7 jours) + bcrypt           |
| PDF           | PDFKit                               |
| HTTP          | Axios (avec intercepteur JWT)        |

---

## 🚀 Installation & démarrage

### Prérequis
- Node.js 18+ (testé avec Node 24)
- Une base MongoDB (Atlas recommandé — gratuit)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # puis éditez .env avec vos valeurs
npm start                 # démarre sur http://localhost:5000
```

Variables d'environnement (`.env`) :
```
MONGO_URI=mongodb+srv://...
PORT=5000
JWT_SECRET=votre_secret_long_et_aleatoire
CLIENT_URL=http://localhost:5173
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev               # démarre sur http://localhost:5173
```

Le frontend est configuré avec un **proxy** Vite qui redirige `/api` vers `http://localhost:5000` — donc pas de souci de CORS en local.

Ouvrez **http://localhost:5173**, créez un compte, et c'est parti 🎉

---

## 🩺 "La connexion / l'inscription ne fonctionne pas"

Dans la grande majorité des cas, ce n'est **pas un bug du code** : c'est que `backend/.env` ne contient pas encore de vraie chaîne de connexion MongoDB (le fichier livré contient volontairement des identifiants factices `USER:PASSWORD`, retirés pour des raisons de sécurité).

Pour vérifier et corriger :

1. Ouvrez **http://localhost:5000/api/health** — regardez le champ `db` :
   - `"db": "connected"` → la base fonctionne, le problème est ailleurs (voir plus bas).
   - `"db": "disconnected"` → c'est bien `MONGO_URI` qui est en cause.
2. Créez un cluster gratuit sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register), créez un utilisateur de base de données, et autorisez votre IP (ou `0.0.0.0/0` pour tester rapidement).
3. Copiez la chaîne de connexion fournie par Atlas dans `backend/.env` → `MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/factuflow?retryWrites=true&w=majority`.
4. Redémarrez le backend (`npm run dev`) — la console doit afficher `✓ MongoDB connecté`.

Depuis cette version, tant que la base n'est pas connectée, l'API répond clairement avec un statut `503` et un message explicite au lieu de laisser la page de connexion se bloquer silencieusement ou afficher une erreur cryptique.

Si `db` est bien `"connected"` et que le login échoue quand même, vérifiez :
- que `frontend/.env.local` (ou les variables de votre hébergeur) pointe vers la bonne URL d'API (`VITE_API_URL`) ;
- les journaux du terminal backend, qui affichent le détail de l'erreur pour chaque requête en échec.

---

## 📁 Structure du projet

```
factures/
├── backend/
│   ├── controllers/      # auth, client, service, invoice, quote, payment, stats, pdf
│   ├── middleware/       # auth (JWT)
│   ├── models/           # User, Client, Service, Invoice, Quote, Payment
│   ├── routes/           # auth, clients, services, invoices, quotes, payments, stats
│   └── server.js         # point d'entrée Express
│
└── frontend/
    └── src/
        ├── api/          # axiosConfig + un fichier par ressource
        ├── components/   # Layout (Sidebar) + ui (PageHeader, StatCard, Modal...)
        ├── contexts/     # AuthContext + ToastContext
        ├── pages/        # Landing, Login, Register, Dashboard, Clients, Services,
        │                 # Invoices, InvoiceForm, InvoiceDetail, Quotes, QuoteForm,
        │                 # QuoteDetail, Payments, Profile
        ├── types/        # types TypeScript du domaine
        └── utils/        # formatage FCFA, dates, calculs totaux
```

---

## 📡 API REST

Toutes les routes (sauf `/auth/register` et `/auth/login`) nécessitent un header :
```
Authorization: Bearer <token>
```

| Méthode | Endpoint                       | Description                          |
|---------|--------------------------------|--------------------------------------|
| POST    | `/api/auth/register`           | Inscription                          |
| POST    | `/api/auth/login`              | Connexion                            |
| GET     | `/api/auth/profile`            | Profil utilisateur                   |
| PUT     | `/api/auth/profile`            | Modifier le profil                   |
| GET/POST/PUT/DELETE | `/api/clients`     | CRUD clients                         |
| GET/POST/PUT/DELETE | `/api/services`    | CRUD produits & services             |
| GET/POST/PUT/DELETE | `/api/invoices`    | CRUD factures                        |
| PATCH   | `/api/invoices/:id/statut`     | Changer le statut                    |
| GET     | `/api/invoices/:id/pdf`        | Télécharger le PDF                   |
| GET     | `/api/invoices/:id/paiements`  | Total payé d'une facture             |
| POST    | `/api/invoices/from-quote/:id` | Transformer un devis en facture      |
| GET/POST/DELETE | `/api/quotes`           | CRUD devis + statut + PDF            |
| GET/POST/DELETE | `/api/payments`         | CRUD paiements                       |
| GET     | `/api/stats/dashboard`         | Statistiques du tableau de bord      |
| GET     | `/api/public/stats`            | Statistiques agrégées publiques (page d'accueil, sans authentification) |
| GET     | `/api/health`                  | État du serveur + de la connexion MongoDB |

---

## 💎 Modèle économique

| Plan       | Prix            | Inclus                                                   |
|------------|-----------------|----------------------------------------------------------|
| Gratuit    | 0 FCFA          | 10 factures/mois, clients & devis illimités, PDF         |
| Pro        | 3 000 FCFA/mois | Factures illimitées, logo, relances auto, stats avancées |
| Business   | 8 000 FCFA/mois | Tout Pro + équipe, WhatsApp, Mobile Money, export comptable |

---

## 🔒 Sécurité

- Mots de passe hachés avec **bcrypt** (10 rounds)
- Authentification **JWT** expirant après 7 jours
- Chaque donnée est **isolée par utilisateur** (`owner: req.userId`)
- Déconnexion automatique côté client si token invalide
- En-têtes HTTP sécurisés via **helmet**
- Limitation du débit (**rate limiting**) sur `/api/auth/login` et `/api/auth/register` — 30 tentatives / 15 min / IP
- L'API renvoie un `503` explicite (au lieu d'une erreur silencieuse) tant que MongoDB n'est pas connecté
- La route `/api/public/stats` n'expose que des compteurs agrégés — jamais de données propres à un utilisateur

---

## 🌍 Déploiement en production

### 1. Base de données — MongoDB Atlas
1. Créez un cluster gratuit sur [Atlas](https://www.mongodb.com/cloud/atlas/register).
2. *Database Access* → créez un utilisateur avec un mot de passe fort.
3. *Network Access* → autorisez `0.0.0.0/0` (ou l'IP sortante de votre hébergeur backend).
4. Récupérez la chaîne de connexion (*Connect → Drivers*).

### 2. Backend — Render (ou Railway)
1. Poussez le dossier `backend/` sur un dépôt Git.
2. Sur [Render](https://render.com) : *New → Web Service*, branchez le repo, dossier racine `backend`.
3. Build command : `npm install` — Start command : `npm start`.
4. Variables d'environnement à définir dans Render (jamais dans le code) :
   - `MONGO_URI` — votre chaîne Atlas
   - `JWT_SECRET` — une longue chaîne aléatoire (ex. générée avec `openssl rand -hex 32`)
   - `CLIENT_URL` — l'URL de votre frontend une fois déployé (ex. `https://factuflow.vercel.app`)
   - `PORT` — laissez Render le définir automatiquement
5. Déployez, puis vérifiez `https://votre-backend.onrender.com/api/health` → `"db": "connected"`.

### 3. Frontend — Vercel (ou Netlify)
1. *New Project*, branchez le repo, dossier racine `frontend`.
2. Build command : `npm run build` — Output directory : `dist`.
3. Variable d'environnement : `VITE_API_URL=https://votre-backend.onrender.com/api`.
4. Déployez, puis testez l'inscription depuis l'URL finale.

### 4. Dernière vérification
- `CLIENT_URL` (backend) doit correspondre exactement à l'URL du frontend déployé, sinon CORS bloquera les requêtes.
- `VITE_API_URL` (frontend) doit pointer vers `.../api` (avec le suffixe).
- Le compte créé en local (autre base) n'existera pas en production — c'est normal, chaque environnement a sa propre base.

---

## 📝 Licence

Projet propriétaire — © FactuFlow. Conçu avec ❤️ pour les entrepreneurs africains.
