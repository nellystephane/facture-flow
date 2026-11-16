# Intégration e-MECeF — Oryxa (environnement DGI de test)

## Périmètre et statut

Oryxa est configuré pour l'environnement de développement DGI uniquement. L'URL de production est explicitement refusée par le client HTTP. La réussite des tests logiciels ne vaut ni acceptation DGI ni homologation.

Fonctions intégrées dans le code :
- configuration par utilisateur de l'IFU vendeur, de l'opérateur et du jeton ;
- chiffrement AES-256-GCM du jeton côté backend ;
- test de connexion et chargement des paramètres DGI (statut, groupes fiscaux, types de facture, moyens de paiement) ;
- préparation, contrôle du total, confirmation, annulation et récupération prudente d'une demande ;
- types FV, FA, EV et EA si la DGI les retourne pour le compte de test ;
- AIB A/B, groupes fiscaux par ligne, taxe spécifique et informations de modification de prix ;
- éléments de sécurité DGI et QR fiscal dans le PDF après confirmation.

Les scénarios dont les règles fiscales ou les réponses DGI ne sont pas confirmées doivent rester bloqués ou être vérifiés avant d'être utilisés. Les options affichées sont chargées auprès de la DGI ; le backend les revalide au moment de l'envoi.

## 1. Configuration backend

Variables à définir dans `backend/.env` en local et dans l'environnement du service backend hébergé :

```env
EMECEF_TEST_BASE_URL=https://developper.impots.bj/sygmef-emcf
EMECEF_ENCRYPTION_KEY=64_caracteres_hexadecimaux
```

Générer une clé unique de 32 octets :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copier la valeur générée sans guillemets. Elle doit contenir exactement 64 caractères hexadécimaux. Utiliser la même clé sur toutes les instances du backend. Ne pas la régénérer après avoir enregistré des jetons chiffrés, sinon ces jetons deviendront illisibles.

Ne jamais placer le jeton DGI ou `EMECEF_ENCRYPTION_KEY` dans `frontend/.env`, une variable `VITE_*`, GitHub, un journal ou une capture d'écran. Ne jamais committer le vrai `.env`.

## 2. Configuration dans Oryxa

Avec un compte propriétaire ou administrateur :
1. Déployer le backend contenant cette version et vérifier `/api/health`.
2. Ouvrir Profil → e-MECeF — environnement de test.
3. Saisir l'IFU vendeur (13 chiffres), le nom de l'opérateur et le jeton de test fourni par la DGI.
4. Enregistrer la configuration.
5. Cliquer « Tester la connexion ».
6. Ouvrir une facture et vérifier que les options DGI (groupes fiscaux, types de facture et paiements) sont chargées.

Le jeton n'est jamais renvoyé au frontend. Si un jeton a été exposé dans un chat ou un dépôt, le renouveler auprès de la DGI.

## 3. Contrôle des montants

Oryxa utilise actuellement un taux de TVA global pour le total commercial. La fiscalisation calcule le montant de référence à partir des prix unitaires, des taux DGI de chaque ligne et des taxes spécifiques transmises.

Avant toute création, le total fiscal calculé doit correspondre au total TTC Oryxa (tolérance maximale de 1 FCFA). Ce contrôle est appliqué aussi aux groupes mixtes et aux taxes spécifiques. Si les montants ne concordent pas, la facture n'est pas envoyée.

Conséquences :
- une ligne ayant un groupe fiscal différent du taux global Oryxa peut être refusée si le total commercial ne reflète pas ce groupe ;
- les taxes spécifiques de ligne sont incluses dans le total TTC commercial Oryxa et apparaissent séparément dans le récapitulatif/PDF ;
- les remises globales restent refusées car leur répartition conforme par ligne n'est pas définie dans le modèle actuel ;
- la base TTC n'est pas proposée : les prix Oryxa sont actuellement traités comme des bases HT ;
- l'AIB est envoyé uniquement si la DGI retourne un taux AIB valide ; son effet exact sur le total doit être confirmé sur les réponses réelles de la plateforme avant de déclarer le scénario validé.

Ne jamais désactiver ce contrôle pour faire passer un test. Si une différence apparaît, corriger les données ou clarifier la règle DGI.

## 4. Premier parcours de test

Utiliser une facture brouillon sans remise, avec une seule ligne, prix unitaire HT, groupe fiscal cohérent avec la TVA Oryxa, sans AIB ni taxe spécifique.

1. Créer ou sélectionner un client de test.
2. Créer une facture commerciale Oryxa et enregistrer.
3. Ouvrir la facture puis e-MECeF (test DGI).
4. Attendre le chargement des options depuis la DGI.
5. Choisir un type de facture et un mode de paiement proposés par la DGI.
6. Vérifier le groupe fiscal et le montant TTC.
7. Cliquer une seule fois sur « Envoyer à la DGI (test) ».
8. Comparer le total retourné par la DGI au total attendu. Oryxa bloque la confirmation si le total manque ou diffère ; une annulation est alors tentée.
9. Si l'état est `pending_confirmation`, confirmer rapidement depuis Oryxa.
10. Vérifier le code MECeF/DGI, le NIM, la date/heure, le compteur et le QR code.
11. Télécharger le PDF fiscalisé et vérifier visuellement les données.
12. Vérifier le document sur le portail DGI : https://developper.impots.bj/sygmef-test/verification.

## 5. États et récupération

- `non_emise` : aucune demande connue.
- `submitting` : création en cours, verrou atomique.
- `pending_confirmation` : UID reçu et total contrôlé.
- `confirming` / `cancelling` : finalisation en cours, verrou atomique.
- `confirmed` : confirmation DGI reçue avec code MECeF/DGI.
- `error` : échec explicite de création sans UID ambigu.
- `unknown` : timeout, erreur réseau ou réponse ambiguë ; ne jamais soumettre à nouveau sans vérification.
- `cancelled` : annulation confirmée par la DGI.

Les factures en cours, confirmées ou incertaines sont verrouillées contre modification/suppression/annulation commerciale. Une demande inconnue ne doit jamais être renvoyée automatiquement. La liste des demandes en attente ne permet pas de conclure qu'un UID absent est confirmé, annulé ou expiré.

Le manuel de test utilisé dans le projet indique une fenêtre courte (environ deux minutes) pour finaliser une demande. Préparer les informations avant de cliquer sur l'envoi.

## 6. Tests logiciels

Backend :
```bash
cd backend
npm ci
npm test
```

Frontend :
```bash
cd frontend
npm ci
npm run build
```

Les tests automatisés mockent l'API DGI. Ils vérifient les règles locales et ne créent pas de facture sur le serveur DGI.

## 7. Dossier d'homologation

Après les essais DGI réels :
- reprendre uniquement les scénarios applicables de l'annexe DGI ;
- conserver pour chaque scénario les captures et PDF lisibles demandés ;
- vérifier chaque QR sur le portail officiel de test ;
- documenter les scénarios non applicables ou à clarifier ;
- transmettre le dossier à `emecefbenin@finances.bj` selon la procédure DGI ;
- attendre la décision écrite de la DGI avant toute utilisation en production.

Le cas « taxe de séjour » ne doit pas être assimilé automatiquement à `taxSpecific` : la correspondance doit être confirmée par la DGI. Le code ne peut pas déclarer l'homologation acquise.
