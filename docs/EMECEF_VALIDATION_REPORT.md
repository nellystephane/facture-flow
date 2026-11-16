# Rapport de validation local — Oryxa e-MECeF

Date : 29 octobre 2026

## Vérifications exécutées dans l'environnement de préparation

- `node --check` : réussi sur les 116 fichiers JavaScript du backend.
- Analyse de syntaxe TypeScript/TSX avec le compilateur TypeScript disponible : réussie sur les 80 fichiers du frontend.
- Scénarios smoke exécutés avec dépendances externes simulées : réussis pour la construction du payload HT, le paiement `CREDIT`, le verrouillage de l'URL de test, le refus des chemins API invalides, la comparaison des totaux, l'annulation après écart de total, le passage en attente lorsque les totaux correspondent et la confirmation avec les éléments de sécurité DGI.
- Tests automatisés ajoutés/étendus : validation du payload, du client HTTP DGI, des erreurs/timeout, de la confirmation/annulation, de la récupération prudente des états, de la protection contre les doublons et du verrouillage des factures en cours de fiscalisation.

## Vérifications qui restent à exécuter dans un environnement avec accès au registre npm

Le lancement de `npm ci` n'a pas pu aboutir ici : le registre `registry.npmjs.org` a échoué avec `EAI_AGAIN` (résolution DNS indisponible), et aucune copie des dépendances n'était présente dans le cache local. En conséquence, il n'a pas été possible d'exécuter le vrai `npm test` Jest ni `npm run build` Vite dans cet environnement. Il serait incorrect de déclarer la suite complète passée sans ces commandes.

À exécuter dès que les dépendances peuvent être installées :

```bash
cd backend
npm ci
npm test

cd ../frontend
npm ci
npm run build
```

Les tests unitaires e-MECeF mockent les réponses DGI. Une validation finale réelle reste également nécessaire sur l'environnement DGI de test avec un jeton de test valide ; aucun appel fiscal réel n'a été effectué pendant ces vérifications locales.


## Révision suivante — audit complémentaire

- Ajout de la sélection FV / FA / EV / EA dans l’interface e-MECeF.
- Référence MECeF/DGI obligatoire pour FA/EA, normalisée à 24 caractères sans tirets avant envoi.
- Ajout du champ AIB (A = 1 %, B = 5 %) dans le payload DGI.
- Prise en charge du champ `taxSpecific` par article et intégration dans le total de référence.
- Ajout d’un bloc de sécurité DGI dans le PDF de facture après confirmation, affichant Code MECeF/DGI, NIM, date, compteur et QR fiscal distinct du QR de paiement.
- Le QR fiscal DGI n’est pas traité comme un lien cliquable ; seul un QR contenant une URL HTTP(S) l’est.
- Vérification exécutée : `node --check` sur les 116 fichiers JavaScript du backend, réussite.
- Suite Jest et build frontend : non exécutés, car les dépendances ne sont pas installées et le cache npm ne contient pas les paquets (`ENOTCACHED` en mode hors ligne). Aucun résultat DGI réel n’est revendiqué dans ce rapport.


### État de la couverture des 20 cas de l'annexe DGI

La préparation du payload et de l'interface prend maintenant en charge les types FV/FA/EV/EA, les groupes fiscaux par ligne, les quantités décimales, AIB A/B, taxes spécifiques par ligne et référence d'avoir. Le scénario « taxe de séjour » (test 11) reste non implémenté faute de champ/règle explicitement décrit dans l'API v1.0 fournie. Les cas doivent être confirmés sur la plateforme DGI et les montants/éléments de sécurité comparés au site de vérification avant d'être déclarés réussis.

### Résultats exécutés pendant cette révision

- Vérification de syntaxe Node : 116 fichiers JavaScript backend, réussite.
- Transpilation de syntaxe TypeScript/TSX : 80 fichiers frontend, aucune erreur de syntaxe. Ce n'est pas un build Vite ni une vérification de types complète.
- Tests de payload inspirés des tests 1 à 20 de l'annexe : 19 réussis dans un harnais local de validation de fonctions, 1 ignoré (test 11, taxe de séjour à clarifier). Ce harnais n'est pas Jest.
- QR fiscal : matrice QR générée pour une valeur de démonstration ; vérification locale que le QR fiscal n'est pas un lien PDF et que le QR de paiement conserve son lien.
- Jest complet et build Vite : non exécutés, car les dépendances npm ne sont pas installées et le registre/cache npm n'a pas permis de les obtenir pendant cette session.
- Plateforme DGI et portail de vérification : pas exécutés dans cette session. Aucun des 19 tests locaux ne constitue une acceptation officielle DGI.


## Révision corrective du 13 novembre 2026

### Corrections apportées au code
- Remplacement du contrôle conditionnel des montants par un rapprochement strict pour tous les cas : groupes mixtes et taxes spécifiques inclus. Écart supérieur à 1 FCFA = refus avant création DGI.
- Chargement des paramètres DGI complets avant la préparation d'une facture ; validation backend du type de facture et du moyen de paiement disponibles.
- Vérification de cohérence entre l'IFU de statut retourné par la DGI et l'IFU configuré dans Oryxa lorsqu'il est présent.
- Chargement des types de facture, groupes/taux fiscaux et moyens de paiement DGI dans l'écran de facture ; bouton d'envoi désactivé tant que les options n'ont pas été récupérées.
- Validation de l'AIB contre les taux effectivement retournés par la DGI.
- Obligation de fournir une justification avec un prix d'origine modifié.
- Mise à jour du guide d'intégration et du fichier `.env.example`.

### Limites conservées volontairement
- Les remises globales restent bloquées : leur représentation par ligne doit être confirmée avec le contrat API.
- La taxe de séjour du cas 11 reste à clarifier auprès de la DGI ; aucune équivalence arbitraire avec `taxSpecific` n'est ajoutée.
- Le modèle commercial Oryxa utilise un taux global de TVA. Les cas avec groupes fiscaux mixtes ou taxes spécifiques ne sont fiscalisables que si le total commercial correspond au total fiscal calculé à 1 FCFA près.
- L'effet comptable exact de l'AIB doit être confirmé par comparaison des réponses de la plateforme DGI. La valeur AIB est transmise, mais aucun calcul net à payer n'est inventé.
- Aucun appel à la DGI, aucune vérification QR externe et aucune homologation ne sont revendiqués dans cette révision.

### Contrôles à exécuter après cette modification
Les dépendances npm ne sont pas installées dans l'environnement de préparation. Les commandes `npm test` et `npm run build` doivent donc être exécutées dans un environnement disposant du registre npm ou du cache correspondant. Les contrôles de syntaxe seront consignés séparément dans la livraison.


### Contrôles exécutés après les corrections du 13 novembre 2026
- `node --check` : réussi sur 118 fichiers JavaScript du backend.
- Transpilation de syntaxe TypeScript/TSX : réussie sur 80 fichiers frontend, sans erreur de syntaxe. Cela ne remplace pas le contrôle complet des types.
- Harnais local ciblé sur `buildPayload` : 8 scénarios réussis (FV simple, groupe mixte cohérent/incohérent, taxe spécifique cohérente/incohérente, référence d'avoir, taux AIB absent, justification de prix modifié).
- Harnais local du contrôleur : 1 parcours de préparation réussi avec options DGI sous forme d'objets `{type, description}`, UID et total concordant.
- Les champs fiscaux de ligne sont maintenant déclarés dans le schéma Zod afin de ne plus être supprimés par `.strip()`. Un test d'intégration a été ajouté pour vérifier leur conservation et le total TTC incluant `taxSpecific`.
- Jest complet et build Vite non exécutés : les dossiers `node_modules` ne sont pas présents dans l'environnement. Le contrôle de syntaxe ne doit pas être présenté comme un passage de Jest ou du build.
- Aucun appel réel à la DGI ni vérification sur le portail n'a été réalisé pendant cette session.
