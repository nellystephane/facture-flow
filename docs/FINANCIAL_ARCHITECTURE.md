# Oryxa — architecture financière

## Objectif

Oryxa sépare strictement :

1. le **montant commercial de la facture** ;
2. le **montant effectivement débité du Client de l'Utilisateur** ;
3. les **frais Pay-in FedaPay** ;
4. les **frais de payout/reversement FedaPay** ;
5. le **solde retirable de l'Utilisateur Oryxa** ;
6. les **reversements réels vers sa destination**.

MongoDB ne contient pas l'argent. `WalletEntry` est un registre interne de créances/mouvements Oryxa. FedaPay reste la source de vérité pour les frais et le statut des opérations réellement exécutées.

## Qui est qui

- **Utilisateur Oryxa** : propriétaire de l'espace qui crée la facture et reçoit le reversement.
- **Client de l'Utilisateur** : personne/entreprise qui paie la facture via la page publique.
- **Oryxa** : tient le registre interne, calcule les montants prévisionnels et orchestre les reversements.
- **FedaPay** : exécute le paiement Pay-in et, lorsque le compte est autorisé, le payout.

## Frais

Une facture possède `fraisSupportesPar` :

- `utilisateur` : le Client paie le TTC de la facture ; les frais Pay-in et le coût prévisionnel du reversement sont supportés par le solde de l'Utilisateur.
- `client` : le montant affiché au Client comprend un unique poste **Frais de transfert**. Le backend calcule le montant total en tenant compte du Pay-in et du payout prévisionnel.

Le front-end ne détaille jamais « Pay-in » et « Payout » au Client.

### Calcul

Lorsque le Client supporte les frais, le Pay-in est supposé proportionnel au montant total débité. Pour une facture `F`, un taux Pay-in `r` et un payout prévisionnel `P` :

`totalClient = (F + P) / (1 - r)`

Le résultat est arrondi au XOF supérieur/entier. Le montant réellement facturé par FedaPay au Pay-in est ensuite enregistré depuis la transaction approuvée.

## Source de vérité

Les valeurs prévisionnelles de `PlatformSettings` servent uniquement à calculer le prix affiché avant le paiement.

À la confirmation du paiement, Oryxa enregistre les frais réellement retournés par FedaPay dans `Payment.fraisPayin`.

À la création/réconciliation d'un payout, Oryxa enregistre :

- `fees` / `fixed_commission` ;
- `commission` ;
- `amount_transferred` ;
- `amount_debited` ;
- statut et références FedaPay.

Ces valeurs réelles priment sur les estimations.

## Solde retirable

`WalletEntry` constitue le ledger. Le solde est :

`crédits paiement + crédits ajustement + crédits annulation - débits frais - débits reversement`

Un paiement en ligne confirmé crée un `credit_paiement` selon `Payment.montantNetUtilisateur`.

Chaque paiement en ligne peut créer un `debit_frais` de provision payout afin que le **solde retirable** soit déjà net de l'estimation du reversement. Lorsqu'un payout est lancé, Oryxa réserve ensuite tout le solde retirable par un `debit_reversement`. Le frais payout n'est donc jamais retiré deux fois : la provision correspond au coût, tandis que le `debit_reversement` correspond au montant transférable réservé.

Un paiement en ligne confirmé ne peut pas être supprimé depuis l'espace utilisateur.

## Payouts réels

Il n'existe **aucun simulateur** dans cette architecture.

Le service `backend/utils/payout.js` appelle réellement :

- `POST /v1/payouts` ;
- `PUT /v1/payouts/start` ;
- `GET /v1/payouts/:id`.

Le job quotidien ne lance un reversement que si l'utilisateur a activé sa destination et si son solde atteint le minimum configuré.

Le job respecte la fréquence choisie (`weekly` ou `monthly`) et réconcilie également les payouts déjà en cours.

FedaPay doit avoir activé la fonctionnalité Payouts sur le compte marchand ; l'activation peut être soumise à validation. Voir la documentation FedaPay et les conditions du compte réel.

## Admin

L'onglet **Finance & reversements** présente :

- encaissements en ligne ;
- frais facturés aux Clients ;
- frais Pay-in réels ;
- frais payout réels ;
- écart de frais / marge technique ;
- mouvements du ledger ;
- reversements FedaPay et leurs statuts ;
- détail des paiements et du net attribué aux Utilisateurs.

La « marge technique » est un indicateur opérationnel et ne doit pas être présentée comme un résultat comptable ou fiscal.

## Limites importantes

- Les cartes bancaires ne sont pas configurées comme destination automatique de payout dans Oryxa tant que le mode de retrait réellement autorisé par FedaPay n'est pas confirmé pour le compte. Le code utilise actuellement le mode `mobile_money` pour les payouts automatiques.
- Le coût exact d'un payout groupé n'est connu qu'au moment où FedaPay crée/exécute le payout. Les barèmes de `PlatformSettings` sont donc des estimations pour le prix affiché avant paiement.
- Les éventuelles différences entre estimation et frais réels doivent être réconciliées comptablement ; elles ne doivent jamais être présentées comme des frais FedaPay exacts avant que FedaPay ne les ait retournés.

## Préparation exacte du payout

Avant `start`, Oryxa réserve d'abord le solde retirable pour empêcher un double reversement concurrent. Le payout FedaPay est créé avec ce montant transférable. Oryxa lit ensuite `fees`, `amount_transferred` et `amount_debited`. Si le coût réel dépasse la provision déjà réservée, la cible de transfert est réduite de l'écart avant `start`. Le coût réel retourné par FedaPay reste la source de vérité. Le montant transféré au bénéficiaire est distinct du montant débité du compte marchand.

Le champ `fraisPayoutProvisionnes` conservé sur `Payment` devient une provision `debit_frais` du ledger. Le `debit_reversement` représente séparément le montant transférable réservé. Côté FedaPay, `amount_debited` représente le total réellement débité du compte marchand (montant transféré + frais).

## Compte FedaPay et conformité

Cette architecture suppose qu'Oryxa utilise un compte FedaPay autorisé à recevoir les encaissements concernés et à effectuer des payouts vers des bénéficiaires. Si Oryxa agit comme plateforme centralisant les fonds de plusieurs Utilisateurs Oryxa, le compte FedaPay doit être configuré selon le modèle de plateforme/marketplace et les sous-comptes ou mécanismes de répartition prévus par FedaPay. Le code ne doit pas être considéré comme une validation réglementaire de ce montage.
