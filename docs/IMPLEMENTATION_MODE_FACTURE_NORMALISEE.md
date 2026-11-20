# Oryxa — implémentation du mode facture normalisée

**Version de travail :** 1.1  
**Date :** 20 novembre 2026  
**Périmètre :** choix du mode dès la création, groupes fiscaux par ligne, calculs HT/TVA/TTC et préparation e-MECeF en environnement de test.

## 1. Choix du parcours à la création

Le formulaire propose désormais deux modes :

- `commerciale` : conserve le fonctionnement commercial historique et sa TVA globale ;
- `normalisee` : charge les groupes et taux depuis les options DGI, affiche les paramètres fiscaux sur chaque ligne et calcule la TVA ligne par ligne.

Le choix est enregistré dans `Invoice.modeFacturation`. Les anciennes factures sans ce champ conservent le mode `commerciale` par défaut.

Le choix « normalisée » ne déclenche aucune requête de création de facture auprès de la DGI. La création Oryxa et la transmission e-MECeF restent deux actions distinctes.

## 2. Calcul du mode normalisé

Pour chaque ligne :

1. Le prix saisi dans Oryxa reste une base HT.
2. Le groupe fiscal est sélectionné sur la ligne.
3. Le taux associé est chargé depuis `/api/invoices/emecef/options`.
4. Le prix unitaire TTC de référence est calculé avec l'arrondi unitaire prévu par le manuel e-MECeF : `round(prixHT × (1 + taux/100))`.
5. Le total de ligne est calculé sur la quantité, puis arrondi comme dans le calcul du payload fiscal.
6. `taxSpecific` reste un montant distinct, facultatif, total pour toute la quantité de la ligne. Il ne doit jamais recevoir le montant de TVA.

Le test mixte A/B de référence :

- groupe A : 2 × 1 000 FCFA, taux 0 % = 2 000 FCFA ;
- groupe B : 3 × 1 000 FCFA, taux 18 % = 3 540 FCFA TTC ;
- total attendu = **5 540 FCFA**.

Aucune remise globale n'est autorisée dans le parcours normalisé à ce stade, car sa représentation exacte dans le payload e-MECeF n'est pas implémentée.

## 3. Taxe spécifique : règle de prudence

Le groupe fiscal détermine le taux fiscal renvoyé par la DGI. Il ne suffit pas à déduire une taxe spécifique. Le champ `taxSpecific` est donc initialisé à zéro et présenté comme facultatif. L'utilisateur ne le renseigne que si une taxe spécifique s'applique réellement et que sa valeur est connue. Le logiciel ne fabrique pas une valeur automatique sur la seule base du groupe A-F.

Le scénario de taxe de séjour demeure à clarifier avec la DGI : ne pas assimiler automatiquement la taxe de séjour à `taxSpecific` sans confirmation écrite.

## 4. Modifications techniques

- `frontend/src/pages/InvoiceForm.tsx` : choix du mode et affichage conditionnel des champs fiscaux par ligne.
- `frontend/src/types/index.ts` : type `modeFacturation` et taux de ligne `taxRate`.
- `frontend/src/api/emecef.ts` : groupe fiscal global facultatif pour les factures dont chaque ligne porte déjà son groupe.
- `backend/models/Invoice.js` : persistance du mode et du taux de ligne.
- `backend/controllers/invoiceController.js` : autorisation contrôlée du champ `modeFacturation` dans la création/modification.
- `backend/utils/invoiceTotals.js` : calcul ligne par ligne pour les factures normalisées ; mode commercial inchangé.
- `backend/controllers/fiscalisationController.js` : groupe de repli dérivé des lignes si les groupes sont déjà précisés article par article.
- `frontend/src/pages/InvoiceDetail.tsx` : changement de groupe fiscal synchronisé avec le taux DGI et suppression de la sélection globale lorsque toutes les lignes ont leur groupe.

## 5. Tests automatiques ajoutés

- Facture mixte A/B : 5 540 FCFA.
- Taxe spécifique séparée de la TVA.
- Conservation du calcul historique pour une facture commerciale.
- Payload DGI mixte : prix unitaire TTC transmis par ligne et groupe correspondant.
- Vérification qu'une TVA de 540 FCFA n'est pas envoyée dans `taxSpecific`.

Ces tests locaux ne constituent pas une confirmation de la DGI. Les transmissions réelles restent à effectuer scénario par scénario dans l'environnement de test, après revue des montants affichés.

## 6. Limites et validation restante

- Le formulaire n'auto-invente pas les taxes spécifiques ; seules les données et règles confirmées par la DGI pourront alimenter une automatisation de ces taxes.
- Les types de facture, références d'avoirs, AIB et moyens de paiement restent dans le bloc e-MECeF de la fiche facture, où les options DGI sont rechargées et contrôlées.
- Les remises globales, les bases TTC et certains régimes particuliers restent soumis aux limites documentées dans `EMECEF_INTEGRATION.md` et `EMECEF_TEST_MATRIX.md`.
- L'installation des dépendances et l'exécution de `typecheck`, `build` et Jest doivent être effectuées dans l'environnement de développement du projet. Elles n'ont pas été certifiées dans cette session.
- Aucun appel réel à la DGI n'a été effectué par cette implémentation.
