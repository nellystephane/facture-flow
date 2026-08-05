# Plan de correction du déploiement

## Objectif
Corriger l'échec de déploiement (Render) causé par une double arborescence du backend et pousser le code sur GitHub.

## Étapes
- [x] Analyser la structure et identifier la cause (double arborescence backend)
- [x] Étape 1 : Copier les controllers récents `backend/routes/controllers/` → `backend/controllers/`
- [x] Étape 2 : Copier `premium.js` de `backend/routes/middleware/` → `backend/middleware/`
- [x] Étape 3 : Copier les models récents `backend/routes/models/` → `backend/models/` (dont Subscription.js)
- [x] Étape 4 : Copier les routes récentes `backend/routes/routes/` → `backend/routes/` (dont subscription/webhook)
- [x] Étape 5 : Copier `backend/routes/utils/` → `backend/utils/`
- [x] Étape 6 : Ajouter `nodemailer` dans `backend/package.json`
- [x] Étape 7 : Supprimer l'arborescence imbriquée obsolète (git rm + disque)
- [x] Étape 8 : Vérifier le démarrage local du serveur ✅ (MongoDB + serveur OK)
- [x] Étape 9 : Committer et pousser sur GitHub (Render + GitHub Actions)

---

## Correction CORS — « Impossible de contacter le serveur »

## Objectif
Corriger le message « Impossible de contacter le serveur » sur le frontend GitHub Pages (nellystephane.github.io/facture-flow). Cause : compararison CORS sur l'URL complète alors que le navigateur n'envoie que l'origine (protocole + hôte) dans l'en-tête `Origin`.

## Étapes
- [x] Diagnostiquer : tester `/api/health` avec `Origin: https://nellystephane.github.io` → 500 CORS refusé ; avec `/facture-flow` → 200 OK
- [x] Corriger `backend/server.js` : normaliser les origines (protocole + hôte + port, sans chemin) via `new URL()`
- [x] Vérifier la syntaxe (`node --check`) ✅
- [x] Valider la logique de normalisation (GitHub Pages OK, localhost OK, origine inconnue refusée) ✅
- [ ] Redéployer le backend sur Render
- [ ] Re-tester login/register depuis `https://nellystephane.github.io/facture-flow`
