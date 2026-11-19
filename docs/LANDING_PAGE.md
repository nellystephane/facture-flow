# Oryxa — Landing page

## Parti pris

Oryxa est présentée comme l'outil évident des freelances, commerçants et PME : on vend le temps gagné, pas la technique. Aucun détail d'implémentation (chiffrement, jetons, secrets) n'apparaît.

Titre : « Gagnez du temps avec Oryxa. »

## Structure (`frontend/src/pages/Landing.tsx`)

1. Accroche et un seul appel à l'action.
2. Six gains : facture rapide, paiement à la réception (bouton Payer), clients centralisés, tableau de bord, relances à 3/7/15 jours, solde retirable.
3. Profils visés.
4. Confiance en langage simple (données protégées, FedaPay, mobile).
5. FAQ (paiement, prix, DGI, usage seul, comptable).
6. Appel à l'action final.

## Règles de rédaction

- Phrases courtes, concrètes, une idée par phrase.
- Aucune promesse que le produit ne tient pas : e-MECeF est en test (dit dans la FAQ), pas d'automatisation WhatsApp, FCFA uniquement.
- Pas de chiffres inventés.

## Mouvement

Le hero entre en cascade (`fx-stagger`), le soulignement de « vrai » se dessine, les autres sections apparaissent au défilement via `<Reveal>`. Styles préfixés `lp-` dans `index.css`.
