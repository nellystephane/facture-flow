# Améliorations financières Oryxa

## Ajouts

- choix `fraisSupportesPar` sur les factures (`utilisateur` / `client`) ;
- calcul du montant total client avec prise en compte du Pay-in et du payout prévisionnel ;
- affichage public regroupé sous « Frais de transfert » ;
- enregistrement des frais Pay-in réels retournés par FedaPay ;
- ledger `WalletEntry` pour les mouvements retirable/non retirable ;
- `Payout` pour les reversements réels et leur réconciliation ;
- configuration Mobile Money et fréquence de reversement dans le profil ;
- reversements automatiques hebdomadaires/mensuels via cron, sans simulateur ;
- appels FedaPay réels `payouts`, `payouts/start` et `payouts/:id` ;
- gestion des événements payout dans le webhook ;
- bloc « Solde retirable » dans le dashboard/paiements ;
- nouvelle section admin « Finance & reversements » : frais Pay-in, frais payout réels, frais facturés aux clients, écart de frais/marge technique, mouvements du ledger et historique des payouts ;
- barème payout prévisionnel configurable dans l'administration ;
- verrouillage de suppression des paiements en ligne confirmés pour préserver l'intégrité du ledger.

## Compatibilité

Les anciennes factures sans `fraisSupportesPar` utilisent `utilisateur` par défaut. Les anciens paiements restent lisibles. Aucun faux paiement ou faux payout n'est créé par le code.

## Vérification

Les fichiers JavaScript backend modifiés passent `node --check`.

Le build complet frontend n'a pas pu être exécuté dans l'environnement de travail car l'installation npm a dépassé le délai disponible ; les dépendances n'étaient pas présentes initialement. Il faut donc lancer `npm ci && npm run build` dans le projet avant déploiement Render.

## 2026-09-22 — Administration, abonnements et lecture financière

- Le prix mensuel est désormais la valeur de référence des abonnements Pro et Business.
- Les engagements 6 mois et 1 an sont recalculés automatiquement avec une réduction fixe de 19 % : `prix mensuel × durée × 81 %`.
- L'API d'abonnement et l'espace administrateur utilisent la même règle afin d'éviter une divergence entre prix affiché et prix envoyé à FedaPay.
- L'administration dispose d'une vraie sidebar responsive, cohérente avec le design Oryxa public : navigation groupée, état actif, menu mobile et accès rapide à la déconnexion.
- Le tableau de bord admin distingue désormais le revenu propre d'Oryxa (abonnements effectivement payés) des flux financiers appartenant aux utilisateurs (paiements de factures, reversements et frais de transfert).
- La section Finance affiche séparément les abonnements Oryxa encaissés, les frais Pay-in, les frais payout et la marge technique liée aux frais facturés aux clients.
- Le « net estimé » des abonnements reste explicitement présenté comme une estimation basée sur le taux moyen FedaPay configuré ; il ne remplace pas les frais réellement retournés par FedaPay.
