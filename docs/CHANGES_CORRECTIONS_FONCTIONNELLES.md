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

## Points ouverts : ce qui est fermé côté code
- Frais de reversement : le code fonctionne que FedaPay AJOUTE les frais au montant ou les INCLUQUE (il lit le montant débité avant `/start`). Pour lever le doute, lancer `node scripts/checkFedapayPayoutFees.js` en sandbox : il n'exécute jamais de reversement.
- `/start` refusé définitivement (HTTP 4xx) : le solde est rendu automatiquement. Cas incertain (réseau) : il reste réservé, et l'admin dispose de `POST /api/admin/payouts/:id/resolve` (`recheck` ou `release`, ce dernier refusé si FedaPay n'a pas confirmé l'échec).
- Un reversement terminé n'est plus jamais réconcilié (évite de rouvrir le ledger).
- Groupe fiscal par ligne et factures d'avoir (FA/EA) : déjà présents dans l'interface ; rien à ajouter.

## Reste à votre charge (manuel)
- Exécuter la sonde sandbox ci-dessus et vérifier le résultat.
- Test DGI en conditions réelles, homologation, puis activation de la production e-MECeF.
- Domaine propre + variables de cookie, `CRON_SECRET` + planificateur externe.
- Lancer `npm test` / `npm run typecheck` et corriger ce qui sortirait.

## Non fait volontairement
- Saisie des prix en TTC : changement du modèle de données et de tous les écrans ; à décider après l'homologation, car le total DGI fait déjà foi.

## Partie 2 — Mouvement, hiérarchie visuelle, landing

- `index.css` : section « Mouvement » (`fxIn`, `fx-page`, `fx-stagger`, `fx-grow-x/y`, `fx-draw`, `fx-pop`, `fx-reveal`), cartes à plat, orbes retirés, reduced-motion respecté.
- `Layout.tsx` : chaque changement de page rejoue l'entrée en cascade (`<div key={pathname} className="fx-page">`).
- Nouveaux : `hooks/useInView.ts`, `components/ui/CountUp.tsx`, `components/ui/Reveal.tsx`.
- `StatCard` : tons `plain | mint | dark`, chiffres animés. `PageHeader` : séparateur et pastille sobre.
- `Dashboard` : carte CA mise en avant, solde en carte sombre, barres et jauges qui poussent.
- `Landing.tsx` réécrite (copy et structure), `LANDING_PAGE.md` réécrit.
- `README.md` aligné : React 18, JWT court + refresh, prix Pro 3 500 / Business 6 000, e-MECeF en test, design.

Non exécuté ici (pas de node_modules ni de navigateur sur l'app React) : `tsc`, `vite build`, rendu réel. Syntaxe TSX vérifiée par transpilation uniquement.

## Partie 3 — Outils de gestion et graphiques

- Backend : `models/Expense.js`, `controllers/expenseController.js`, `routes/expenseRoutes.js`, `validators/expenseValidators.js` ; `utils/analyticsCore.js` + `controllers/analyticsController.js` + `routes/analyticsRoutes.js` ; `utils/clientHistory.js` + `GET /clients/:id/historique` ; montage dans `server.js`.
- Tests ajoutés : `analyticsCore.test.js`, `clientHistory.test.js` (logique pure, exécutés ici en harnais maison, pas via Jest).
- Frontend : `components/charts/*` (ChartModal, ChartButton, SeriesChart, BreakdownChart), `pages/Expenses.tsx`, `pages/ClientDetail.tsx`, `api/analytics.ts`, `api/expenses.ts`, entrée « Dépenses » dans la barre latérale, boutons graphique sur 6 pages.
- Non exécuté ici : `tsc`, build, rendu navigateur, requêtes MongoDB réelles (contrôleurs vérifiés par `node --check` seulement).

## Partie 4 — Stock, factures récurrentes, vente comptoir, affiliation, outils admin

**Stock** : `Service` gagne `suiviStock`, `stock`, `seuilAlerte`, `prixAchat` ; `models/StockMovement.js`, `utils/stock.js`. La sortie de stock est déclenchée une seule fois par facture (drapeau atomique `Invoice.stockApplique`) à l'envoi ou au paiement, et rendue à l'annulation. Entrées / ajustements manuels via les routes de `serviceRoutes`. Interface dans `Services.tsx` ; le choix d'un article dans `InvoiceForm` renseigne `item.service`.

**Factures récurrentes** : `models/RecurringInvoice.js`, `utils/recurring.js` (calcul des échéances), `controllers/recurringController.js`, `jobs/recurringInvoices.js` (cron 6h30 + tâche interne `/api/internal/jobs/recurrentes` pour un déclencheur externe protégé par `CRON_SECRET`). Chaque émission « réserve » l'échéance par `findOneAndUpdate`, donc pas de doublon si deux instances tournent. Page `Recurring.tsx`.

**Vente comptoir** : `POST /invoices/vente-rapide` (facture payée immédiatement, stock mis à jour) ; page `VenteRapide.tsx`.

**Affiliation** : page `Affiliation.tsx` réécrite (texte clair, chiffres animés, bouton graphique).

**Outils admin** : analyses (`utils/adminAnalytics.js`, 13 indicateurs, bouton graphique réutilisant la fenêtre `ChartModal` via une source de données injectable), fiche utilisateur détaillée, journal d'audit + événements de sécurité, état du système (présence des réglages, jamais les valeurs ; dernière exécution des tâches planifiées), exports CSV utilisateurs et abonnements. Frontend : `pages/admin/AdminOutils.tsx`, section « Exploitation » dans la navigation admin. Test : `adminAnalytics.test.js`.

**Non fait volontairement** : multi-devises (touche tout le modèle), relances WhatsApp automatiques par API (payante, plus tard), refonte de l'affichage e-MECeF.

**Non exécuté ici** : `tsc`, `vite build`, rendu navigateur, Jest, MongoDB. Vérifiés : syntaxe (`node --check`, transpilation TSX) et logique pure (analyses, historique client, récurrence, analyses admin).

## Partie 5 — Multi-devises (phases 1 et 2)

**Principe** : la devise est une propriété du document (facture, devis, paiement, modèle récurrent). Tout l'argent d'Oryxa (FedaPay, ledger, reversements, abonnements, affiliation) reste en FCFA. Les documents existants n'ont pas de champ `devise` : ils valent XOF, aucune migration.

- `backend/utils/currency.js` : liste des devises (XOF, EUR, USD, GBP, CAD, CHF, MAD, NGN, GHS, GNF), normalisation (« FCFA » → XOF), arrondi par devise (0 décimale en XOF/GNF, 2 sinon), `formatMoney`, `resolveDocumentCurrency` (devise + taux figé obligatoire hors XOF).
- Modèles : `devise` + `tauxChange` (FCFA pour 1 unité) sur Invoice, Quote, RecurringInvoice ; `devise` + `tauxChange` sur Payment (copiés de la facture, jamais de conversion à l'encaissement). Le forçage « tout en FCFA » du modèle User et la migration au démarrage ont été retirés.
- `computeInvoiceTotals` arrondit `totalDu` selon la devise et renvoie `totalXOF` ; `paidAmountXOF`/`sumPaidXOF` pour les paiements.
- Statistiques (tableau de bord, analyses, fiche client) : tout est additionné en équivalent FCFA au taux figé de chaque document, pour ne jamais mélanger euros et francs.
- Limites volontaires : paiement en ligne FedaPay et e-MECeF/DGI refusés (message clair) pour une facture hors FCFA ; ces factures se règlent par virement/espèces enregistrés par l'entrepreneur. Dépenses toujours en FCFA.
- PDF, e-mails, pages publiques (facture/devis) et reçus utilisent la devise du document.
- Frontend : `utils/format.ts` (devises, `formatMoney`), composant `DeviseField` (devise + taux) sur facture, devis et récurrentes, affichage dans la devise du document sur toutes les pages concernées.
- Test ajouté : `backend/tests/currency.test.js` (logique pure, exécuté ici dans le harnais maison).

**Non fait** : devise par défaut du compte dans le Profil (le champ existe côté User mais n'a pas d'écran), taux automatique, paiement en ligne hors FCFA, devise sur les dépenses, bouton e-MECeF masqué côté interface pour une facture hors FCFA (seul le serveur la refuse).
**Non exécuté ici** : `tsc`, build, rendu navigateur, Jest, MongoDB.
