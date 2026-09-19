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
