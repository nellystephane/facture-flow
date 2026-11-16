# Corrections fonctionnelles — passe 1

Périmètre : erreurs fonctionnelles relevées à l'audit. Le style, le copywriting et l'alignement de la documentation viennent après.

## Paiements et ledger
- Webhook FedaPay : prise en charge atomique du paiement, étapes reprenables après un arrêt serveur, un seul email, contrôle du montant réellement débité.
- Ledger : clé d'idempotence `dedupeKey` + index unique partiel. Deux webhooks simultanés ne peuvent plus créditer deux fois.
- `fedapayTransactionId` (Payment, Subscription) : index unique **partiel**. Les paiements manuels (valeur nulle) ne se bloquent plus entre eux.
- Remboursements : logique unique `utils/refunds.js`, utilisée par le webhook ET le bouton admin (qui ne débitait pas le solde avant). Reprenable après crash.
- Bouton admin « litige » : fonction corrompue (code de remboursement collé dedans) réécrite.
- Solde négatif exposé (`dette`) au lieu d'être masqué.

## Reversements
- Les frais FedaPay sont prélevés sur le solde au moment du reversement (plus de provision estimative au crédit).
- Réservation du solde avant tout appel réseau ; `startRequestedAt` = point de non-retour avant `/start`.
- Reversements bloqués avant démarrage libérés automatiquement ; après `/start`, jamais de libération aveugle.
- Écritures de ledger idempotentes (libération totale, restitution de l'écart, surcoût).
- Routes réservées au propriétaire/admin (un collaborateur ne peut plus changer le numéro de retrait ni vider le solde).

## Totaux de facture
- Source unique `utils/invoiceTotals.js` (taxe spécifique incluse, total DGI prioritaire une fois confirmé), utilisée par modèle, page publique, paiement manuel, stats, PDF.
- Paiement manuel : montant validé, plafonné au reste dû, refus sur facture annulée ; suppression impossible si des écritures financières existent.
- Statistiques : paiements remboursés exclus.
- Pages publiques : liste blanche (DTO) — plus d'identifiants FedaPay ni de notes internes exposés.

## e-MECeF (test)
- Écart d'arrondi DGI toléré (0,5 FCFA par unité) ; un vrai écart reste bloquant.
- Confirmation automatique après vérification du total DGI (désactivable : `autoConfirm:false`).
- Nouvelle demande possible après une annulation ; `POST /invoices/:id/emecef/reset` pour sortir d'un état incertain après vérification auprès de la DGI (historique conservé).
- Statut commercial recalculé après confirmation.
- Ligne « Arrondi fiscal (DGI) » sur le PDF.

## Divers
- Abonnement : montant vérifié ; renouvellement anticipé prolongé à partir de la fin de la période en cours.
- Validateurs : les 9 modèles de facture acceptés ; modèle de devis ajouté.
- Cookie malformé : n'interrompt plus toutes les requêtes. `COOKIE_SAMESITE` / `COOKIE_DOMAIN` pour un domaine propre.
- Jobs : verrou distribué + déclencheurs externes `POST /api/internal/jobs/:name` (en-tête `x-cron-secret`, variable `CRON_SECRET`).
- Frontend : bouton de réinitialisation e-MECeF, script `npm run typecheck`, `strict: true`.

## À faire par vous
- Déployer : la migration `migrateFinancialIndexes` s'exécute au démarrage (bloquante).
- Définir `CRON_SECRET` et configurer un planificateur externe si l'hébergement met le serveur en veille.
- Domaine propre partagé front/API puis `COOKIE_SAMESITE=lax` + `COOKIE_DOMAIN` (connexion iPhone/Safari).
- Lancer `npm test` et `npm run typecheck` (non exécutables dans mon environnement).

## Limites connues (non faites)
- Sémantique exacte des frais de reversement FedaPay à confirmer en sandbox (le code s'adapte au montant débité renvoyé avant `/start`).
- Un `/start` rejeté de façon définitive laisse le solde réservé avec un message de vérification manuelle : pas d'outil admin dédié.
- Prix TTC par ligne, groupes fiscaux par ligne côté UI, avoirs, production e-MECeF : reportés.
