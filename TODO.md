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
- [ ] Étape 9 : Committer et pousser sur GitHub (Render + GitHub Actions)
