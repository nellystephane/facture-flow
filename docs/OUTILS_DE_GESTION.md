# Outils de gestion et analyse graphique

## Ce qui existe

| Outil | Où | API |
|---|---|---|
| Fiche client (historique, reste à payer, délai moyen, fiabilité) | `/app/clients/:id` | `GET /api/clients/:id/historique` |
| Dépenses (CRUD, résumé du mois, catégories) | `/app/depenses` | `/api/expenses`, `/api/expenses/summary` |
| Analyse graphique | bouton graphique sur Tableau de bord, Factures, Devis, Clients, Paiements, Dépenses, Fiche client | `GET /api/analytics/catalog`, `GET /api/analytics` |
| Acomptes et paiements partiels | déjà gérés côté serveur (le statut passe à « Payée » quand la somme couvre le total) | `/api/payments` |

## Modal « Analyser »

L'utilisateur coche les éléments (encaissements, dépenses, bénéfice, montant facturé, impayés, nombre de factures/devis, nouveaux clients, répartitions par statut / moyen de paiement / catégorie / client, ancienneté des impayés), choisit la période (30 j, 90 j, 6 mois, 12 mois, année, dates libres) et le regroupement (jour, semaine, mois). Les éléments d'unités différentes (FCFA et nombres) sont tracés sur deux graphiques séparés. Export CSV intégré.

- Plan Gratuit : encaissements, dépenses, répartitions par statut, moyen de paiement et catégorie.
- Plan Pro / Business : tous les éléments (cadenas sur les autres pour le Gratuit, vérifié aussi côté serveur).
- Calcul : `backend/utils/analyticsCore.js` (logique pure, fuseau Bénin UTC+1), testé dans `backend/tests/analyticsCore.test.js`.
- Graphiques : SVG maison (`frontend/src/components/charts/`), aucune dépendance ajoutée.

## Décisions et reports

- Relances WhatsApp : restent par partage de lien. L'API WhatsApp Business (payante) est reportée à une phase de maturité d'Oryxa.
- Affichage de la normalisation e-MECeF : inchangé pendant la phase de test, à retravailler ensuite.
- Après la phase de test : page d'affiliation à réécrire, outils supplémentaires pour la page admin.
- Non fait à ce stade : catalogue produits avec stock, ventes comptoir sans client, factures récurrentes, multi-devises.

## Ajouts : stock, récurrentes, comptoir, admin
- **Stock** (Services) : quantité, seuil d'alerte, prix d'achat, mouvements. Sortie automatique à l'envoi/au paiement d'une facture, une seule fois.
- **Factures récurrentes** : modèles hebdo/mensuel/etc., émission automatique (cron 6h30, déclencheur externe `recurrentes`).
- **Vente comptoir** : encaissement immédiat avec facture payée.
- **Admin** : analyses graphiques, fiche utilisateur, journal d'audit, état du système, exports CSV.
