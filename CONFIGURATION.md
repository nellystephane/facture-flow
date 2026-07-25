# Configuration — mise en route des nouvelles fonctionnalités

Le code est complet et fonctionnel (pas de simulation), mais 3 services externes doivent être connectés avec vos propres identifiants avant de fonctionner en réel.

## 1. Sécurité — À FAIRE EN PREMIER
Le fichier `backend/.env` contenait un mot de passe MongoDB Atlas en clair dans l'archive reçue.
- Allez sur MongoDB Atlas > Database Access > changez le mot de passe de l'utilisateur.
- Mettez à jour `MONGO_URI` dans `backend/.env` (sur votre machine ET sur Render) avec le nouveau mot de passe.
- `backend/.gitignore` exclut déjà `.env`, donc si vous n'avez jamais fait `git add -f .env`, il n'a normalement pas fuité sur GitHub — vérifiez tout de même sur votre dépôt.

## 2. Emails (Brevo) — factures, reçus, notifications
1. Créez un compte gratuit sur https://www.brevo.com (300 emails/jour offerts).
2. Paramètres > SMTP & API > SMTP → récupérez login et clé.
3. Dans `backend/.env` :
   ```
   BREVO_SMTP_USER=votre-login@smtp-brevo.com
   BREVO_SMTP_PASS=votre-cle-smtp
   EMAIL_FROM="Votre Entreprise <no-reply@votredomaine.com>"
   ```
Tant que ces variables sont vides, l'appli répond clairement "email non configuré" au lieu d'échouer silencieusement.

## 3. Paiements en ligne (FedaPay)
1. Créez un compte sur https://fedapay.com (mode sandbox pour tester sans argent réel).
2. Développeurs > Clés API → copiez la clé secrète.
3. Dans `backend/.env` :
   ```
   FEDAPAY_SECRET_KEY=sk_sandbox_xxxxx
   FEDAPAY_ENVIRONMENT=sandbox
   ```
4. Paramètres > Webhooks (côté FedaPay) → créez un webhook pointant vers :
   `https://votre-backend.onrender.com/api/webhooks/fedapay`
   Copiez le secret généré dans `FEDAPAY_WEBHOOK_SECRET`.
5. Quand vous êtes prêt pour de l'argent réel : régénérez une clé **live**, changez `FEDAPAY_ENVIRONMENT=live`.

⚠️ Sans webhook configuré, les paiements en ligne restent bloqués en statut "en attente" — c'est le webhook qui confirme réellement le paiement et déclenche facture payée + reçu + email.

## 4. Variable indispensable
```
CLIENT_URL_PUBLIC=https://votre-frontend.github.io/votre-repo
```
Utilisée pour générer les liens de paiement corrects dans les emails et PDF.

## 5. Installation
```bash
cd backend && npm install
cd ../frontend && npm install
```
(nodemailer a été ajouté à `backend/package.json` — `npm install` le récupérera)

## Ce qui a été corrigé/ajouté
- `backend/server.js` était vide → le backend ne démarrait pas du tout. Reconstruit entièrement.
- Chevauchement icône/texte des champs de saisie → bug de cascade CSS (Tailwind v4), corrigé dans `index.css`.
- Envoi de facture par email → réel (Brevo), avec PDF joint et lien de paiement.
- PDF facture/devis/reçu → mise en page professionnelle, nom de l'entreprise émettrice en en-tête, bouton de paiement cliquable, coordonnées bancaires pour virement.
- Paiement en ligne → page publique `/payer/:token`, intégration FedaPay (Mobile Money, carte, virement), webhook de confirmation.
- Reçu de paiement → généré et envoyé automatiquement après tout paiement (en ligne ou cash), téléchargeable à tout moment.
- Paiement cash → toujours enregistré manuellement par vous, mais déclenche désormais reçu + email réels.
- Tarifs préconçus → catalogue de services existant, réutilisable et ajustable par facture.
- Facturation rapide depuis un tarif → nouvelle fonctionnalité Premium (`Produits & Services` → "Facturer directement à un client").
- Abonnements 6 mois / 1 an → nouvelle page `/app/abonnement`, paiement via FedaPay.
- Info-bulles d'aide (icône "!") ajoutées sur les points potentiellement peu clairs (lien de paiement, tarif ajustable, durée d'abonnement, moyens de paiement).
