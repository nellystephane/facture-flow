# Accès à l'espace admin Oryxa

L'espace admin (`/admin`) gère la plateforme **de fond en comble** :
utilisateurs, revenus réels, paiements/litiges FedaPay, tarifs des
abonnements, contenu des pages légales. Il est volontairement **séparé
à 100 %** du système de comptes utilisateurs :

- Un admin n'est **pas** un `User` en base de données.
- Il existe **un seul administrateur plateforme**, défini par `ADMIN_EMAIL` + un hash bcrypt.
- Son accès est séparé des comptes utilisateurs et n'est jamais attribué via un rôle User.
- Les JWT admin sont signés avec `ADMIN_JWT_SECRET`, indépendant de `JWT_SECRET`.
- Le JWT d'accès est court et le renouvellement passe par un cookie `httpOnly` rotatif, non accessible à JavaScript.

Personne ne peut s'auto-attribuer l'accès admin depuis l'app : c'est
100% manuel, via les variables ci-dessous.

## Variables d'environnement à définir sur Render

Dans le service **backend** sur Render → Environment :

| Variable | Rôle | Exemple |
|---|---|---|
| `ADMIN_EMAIL` | Email de l'unique administrateur autorisé | `moi@oryxa.com` |
| `ADMIN_EMAILS` | Compatibilité temporaire ; doit contenir exactement une adresse si utilisé | `moi@oryxa.com` |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt du mot de passe admin (recommandé) | voir ci-dessous |
| `ADMIN_PASSWORD` | Mot de passe en clair **uniquement pour le développement** | `AdminOxara` |
| `ADMIN_JWT_SECRET` | Secret **indépendant** pour signer les JWT admin, minimum 32 caractères en production | une très longue chaîne aléatoire |

Vous n'avez besoin **que d'une seule** des deux variables de mot de passe :
- `ADMIN_PASSWORD_HASH` si elle est définie, elle est **toujours prioritaire**.
- Sinon `ADMIN_PASSWORD` sert de repli (comparaison en clair — fonctionnel
  mais moins sûr, à réserver au démarrage/tests).

## Démarrage rapide (avec le mot de passe en clair)

1. Sur Render, ajoutez :
   - `ADMIN_EMAIL = votre-email@exemple.com`
   - `ADMIN_PASSWORD = AdminOxara` (développement seulement)
2. En production, utilisez plutôt `ADMIN_PASSWORD_HASH` et `ADMIN_JWT_SECRET`.
3. Rendez-vous sur `https://votre-app/admin/login`
4. Connectez-vous avec cet email + le mot de passe configuré

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

- En production, `JWT_SECRET` et `ADMIN_JWT_SECRET` sont obligatoires, indépendants et longs.
- `ADMIN_PASSWORD_HASH` est obligatoire en production ; le mot de passe admin en clair est refusé.
- Il n'y a qu'un seul administrateur : `ADMIN_EMAIL`. Une ancienne variable `ADMIN_EMAILS` n'est tolérée que si elle contient exactement une adresse.
- Les JWT d'accès expirent rapidement ; les refresh tokens sont rotatifs, stockés uniquement en cookie `httpOnly`, et révoqués côté serveur.
- Les sessions peuvent être révoquées immédiatement, y compris après changement de mot de passe ou déconnexion globale.
- Les connexions admin sont journalisées (IP, navigateur, date, résultat) et une nouvelle adresse IP peut déclencher une alerte email.
- Les erreurs internes ne renvoient plus leur détail en production.
- Les routes sensibles sont limitées par IP + identifiant/token ; les paiements et réponses publiques ont leurs propres limites.
- Les webhooks FedaPay exigent une signature valide et un timestamp récent ; les traitements financiers sont idempotents.
- Les liens publics facture/devis peuvent être révoqués ou régénérés.
- Le MFA administrateur n'est volontairement **pas activé dans cette phase**.

## Sessions et audit

L'espace admin expose également des sessions individuelles (`/api/admin/sessions`) afin de pouvoir identifier et révoquer une session précise. `POST /api/admin/logout-all` invalide toutes les sessions admin.

Les connexions et opérations d'administration sont journalisées dans `AdminAuditLog`, tandis que les événements inhabituels (échec de connexion, nouvelle IP) sont enregistrés dans `SecurityEvent`.
