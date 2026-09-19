# Accès à l'espace admin Oryxa

L'espace admin (`/admin`) gère la plateforme **de fond en comble** :
utilisateurs, revenus réels, paiements/litiges FedaPay, tarifs des
abonnements, contenu des pages légales. Il est volontairement **séparé
à 100 %** du système de comptes utilisateurs :

- Un admin n'est **pas** un `User` en base de données.
- Son accès repose sur une **liste d'emails autorisés** + **un mot de passe
  partagé**, tous deux définis par variables d'environnement — jamais en
  base de données, jamais dans le code source versionné.
- Le token émis à la connexion admin (`platformAdmin: true`) est
  totalement différent du token utilisateur : l'un n'ouvre jamais l'accès
  de l'autre, même en cas de fuite d'un des deux.

Personne ne peut s'auto-attribuer l'accès admin depuis l'app : c'est
100% manuel, via les variables ci-dessous.

## Variables d'environnement à définir sur Render

Dans le service **backend** sur Render → Environment :

| Variable | Rôle | Exemple |
|---|---|---|
| `ADMIN_EMAILS` | Liste des emails autorisés à se connecter à `/admin`, séparés par des virgules | `moi@oryxa.com,associe@oryxa.com` |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt du mot de passe admin (recommandé) | voir ci-dessous |
| `ADMIN_PASSWORD` | Mot de passe **en clair** (repli rapide, à éviter en production) | `AdminOxara` |
| `ADMIN_JWT_SECRET` | Secret pour signer les tokens admin (sinon `JWT_SECRET` est réutilisé) | une longue chaîne aléatoire |

Vous n'avez besoin **que d'une seule** des deux variables de mot de passe :
- `ADMIN_PASSWORD_HASH` si elle est définie, elle est **toujours prioritaire**.
- Sinon `ADMIN_PASSWORD` sert de repli (comparaison en clair — fonctionnel
  mais moins sûr, à réserver au démarrage/tests).

## Démarrage rapide (avec le mot de passe en clair)

1. Sur Render, ajoutez :
   - `ADMIN_EMAILS = votre-email@exemple.com`
   - `ADMIN_PASSWORD = AdminOxara`
2. Rendez-vous sur `https://votre-app/admin/login`
3. Connectez-vous avec cet email + `AdminOxara`

C'est tout — mais passez à la méthode ci-dessous dès que possible : un
mot de passe en clair dans les variables d'environnement Render reste
lisible par quiconque a accès au dashboard Render de votre projet.

## Méthode recommandée (mot de passe haché)

1. En local, après `npm install` dans `backend/` :
   ```bash
   cd backend
   node scripts/generateAdminPasswordHash.js "VotreNouveauMotDePasse"
   ```
2. Copiez le hash affiché (commence par `$2a$` ou `$2b$`).
3. Sur Render, définissez `ADMIN_PASSWORD_HASH` avec ce hash, et
   **supprimez** `ADMIN_PASSWORD` s'il existait.
4. Redéployez (ou attendez le redeploy automatique).

Pour changer le mot de passe plus tard, répétez ces étapes avec un
nouveau mot de passe — le hash précédent n'a plus besoin d'être conservé
nulle part.

## Ce que peut faire un admin

- **Utilisateurs** : voir tous les comptes, suspendre/réactiver un compte
  (bloque immédiatement la connexion, même si l'utilisateur a déjà un
  token valide), changer manuellement le plan d'un compte.
- **Vue d'ensemble** : nombre d'abonnés par plan, revenu brut, frais
  FedaPay estimés, **revenu réel estimé** (brut − frais), croissance des
  6 derniers mois.
- **Paiements** : historique complet, signaler/résoudre un litige,
  marquer un paiement comme remboursé (ceci note seulement l'information
  côté Oryxa — le remboursement réel s'effectue sur le tableau de bord
  marchand FedaPay).
- **Tarifs** : modifier les prix des plans Pro/Business (1, 6, 12 mois)
  et le pourcentage de frais FedaPay utilisé pour l'estimation du revenu
  réel — sans toucher au code.
- **Contenu légal** : surcharger le texte des CGU, de la politique de
  confidentialité et des mentions légales sans redéployer le site (laisser
  vide = le site garde son contenu par défaut, codé dans le frontend).

## Sécurité — à retenir

- Ne commitez **jamais** `ADMIN_PASSWORD` ou `ADMIN_PASSWORD_HASH` dans le
  code : uniquement dans les variables d'environnement Render.
- Le rate-limiting de `/api/admin/login` est le même que celui de la
  connexion utilisateur (voir `backend/server.js`) : quelques tentatives
  par fenêtre de temps, pour freiner le brute-force.
- Un compte suspendu depuis l'admin est bloqué **immédiatement**, y
  compris s'il a déjà un token de session valide (vérifié à chaque requête,
  pas seulement à la connexion).
