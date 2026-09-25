# Oryxa — Programme d'affiliation

## Principe

L'affiliation est un rôle supplémentaire du même compte Oryxa. Un utilisateur peut être :

- client uniquement ;
- affilié uniquement ;
- client + affilié.

Il n'existe pas de deuxième identité Oryxa à créer pour un client qui active l'affiliation.

## Attribution

Un lien de recommandation contient le code affilié :

`/affiliation?ref=CODE`

Le code est conservé pendant le parcours d'inscription et transmis au backend. Le backend crée une relation unique entre l'affilié et le compte filleul.

Un affilié ne peut pas s'auto-attribuer son propre compte et un compte filleul ne peut pas être attribué deux fois.

## Vérification

L'adresse email doit être vérifiée avant l'activation de l'espace affilié. Un numéro de téléphone ou WhatsApp est également demandé à l'activation.

**Important :** la version actuelle ne simule pas une vérification SMS/WhatsApp. Une vérification automatique du numéro nécessite un fournisseur de SMS/WhatsApp et ses identifiants de production. Tant qu'un tel fournisseur n'est pas configuré, Oryxa ne prétend pas avoir vérifié le numéro.

## Avantage filleul

Les paramètres sont stockés dans `PlatformSettings.affiliate` et modifiables depuis `/admin/affiliation` :

- réduction par défaut : 30 % ;
- durée : 3 mois ;
- commission Pro : 250 FCFA ;
- commission Business : 400 FCFA ;
Le seuil de retrait reste celui du mécanisme de reversement Oryxa déjà configuré dans les paramètres financiers de la plateforme.

La réduction d'affiliation s'ajoute au calcul de prix de la durée choisie sans modifier rétroactivement les abonnements déjà payés. Le nombre de mois déjà consommés est historisé sur la relation de parrainage.

## Commission

Une commission n'est créée que lorsque le webhook FedaPay confirme réellement un abonnement comme `payee`.

Chaque abonnement payé éligible produit une commission récurrente selon le plan. La commission est enregistrée dans `AffiliateCommission` et créditée dans le ledger financier `WalletEntry` sous `credit_affiliation`.

Cela permet au solde affilié d'utiliser le même mécanisme de reversement que les autres soldes Oryxa.

Les retries du webhook sont idempotents grâce à l'unicité de `AffiliateCommission.subscription`.

## Administration

La page admin Affiliation permet de consulter :

- affiliés actifs ;
- clics ;
- filleuls ;
- clients payants ;
- commissions ;
- réglages de réduction, durée, commissions et seuil de retrait.

Les valeurs sont centralisées afin d'éviter des montants différents entre frontend, paiement et backend.
