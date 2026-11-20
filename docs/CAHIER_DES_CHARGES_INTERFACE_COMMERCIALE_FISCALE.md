# Cahier des charges technique — séparation commerciale et fiscale Oryxa

**Version :** 1.0  
**Périmètre :** phase 1 — interface utilisateur et préparation e-MECeF en environnement DGI de test  
**Base analysée :** archive `oryxa-emecef-phase1-amelioree`  
**Statut :** spécification et première implémentation frontend ; validation métier et tests DGI réels encore requis.

## 1. Objectif

Séparer explicitement deux opérations qui ne doivent pas être confondues :

1. **Facturation commerciale Oryxa** : rédiger la facture destinée au client, enregistrer les lignes, les prix, les dates, la devise, les conditions et les notes, puis éventuellement envoyer le document commercial par email ou le partager.
2. **Fiscalisation e-MECeF** : préparer les données réglementaires, vérifier les paramètres fournis par la DGI, transmettre une demande à l'environnement de test, confirmer ou récupérer son état et produire les éléments fiscaux retournés par la DGI.

L'enregistrement ou l'envoi commercial ne doit jamais être interprété comme une émission e-MECeF. Inversement, la confirmation DGI ne doit pas être présentée comme un simple envoi email.

## 2. Diagnostic de l'existant

- `InvoiceForm.tsx` regroupe la saisie commerciale et plusieurs paramètres propres à la DGI au niveau des lignes.
- Le formulaire de création ne présente pas d'action e-MECeF clairement identifiée ; l'action se trouve dans la fiche de facture.
- `InvoiceDetail.tsx` contient déjà la configuration globale DGI, la préparation, la confirmation, l'annulation et la récupération prudente d'état.
- Les propriétés `taxSpecific`, `taxGroup`, `originalPrice` et `priceModification` sont stockées dans les lignes de facture.
- Le total TTC Oryxa ajoute actuellement `taxSpecific` au montant commercial. Ce comportement est conservé : la modification de cette taxe peut donc modifier le montant présenté au client.
- L'API standard `PUT /api/invoices/:id` n'autorise actuellement la modification que des factures au statut `brouillon`. Cette restriction est respectée par la première implémentation de la préparation fiscale.
- Le backend verrouille les factures lorsque la fiscalisation est en cours, incertaine ou confirmée. Ces protections doivent rester actives.

## 3. Principes fonctionnels

### 3.1 Deux espaces visuels

**Espace commercial — création/modification de facture**
- Client, objet, dates, devise et taux de change.
- Articles : description, quantité et prix unitaire.
- Remise, TVA commerciale, frais de paiement, notes et modèle PDF.
- Actions : prévisualiser le PDF commercial, enregistrer, enregistrer et envoyer par email.
- Aucun bouton « Envoyer à la DGI » dans ce formulaire.
- Les champs de groupe fiscal et de modification de prix ne sont pas affichés dans la saisie commerciale.

**Espace fiscal — fiche de facture**
- Bloc « Préparation fiscale » par ligne.
- Bloc « e-MECeF (test DGI) » avec les options et opérations DGI.
- Statut fiscal affiché indépendamment du statut commercial.
- Bouton de sauvegarde des paramètres fiscaux distinct du bouton de transmission DGI.
- La transmission est impossible tant que des paramètres fiscaux sont modifiés mais non sauvegardés.

### 3.2 Parcours nominal

1. L'utilisateur crée sa facture commerciale.
2. Il enregistre la facture sans que cela contacte la DGI.
3. Il ouvre la fiche de la facture.
4. Dans « Préparation fiscale », il renseigne si nécessaire les paramètres propres aux lignes.
5. Il enregistre ces paramètres et vérifie le total TTC mis à jour.
6. Dans « e-MECeF (test DGI) », il attend le chargement des options DGI.
7. Il choisit le type de facture, le groupe fiscal général, l'AIB éventuel, le moyen de paiement déclaré et la référence d'origine si le type est un avoir.
8. Il relit les montants puis lance une seule demande de test.
9. Si la DGI renvoie une demande en attente, il la confirme dans la fenêtre autorisée ou vérifie son état. En cas de résultat incertain, il ne renvoie jamais la facture automatiquement.
10. Après confirmation DGI, le code, le NIM, la date, le compteur et le QR fiscal sont affichés et intégrés au PDF selon les données disponibles.

## 4. Exigences détaillées

| ID | Exigence | Critère d'acceptation |
|---|---|---|
| COM-01 | Création commerciale indépendante | Enregistrer une facture ne déclenche aucun appel de préparation e-MECeF. |
| COM-02 | Saisie commerciale lisible | Le formulaire conserve client, lignes, quantités, prix, remise, TVA, devise, notes et PDF. |
| COM-03 | Envoi commercial distinct | L'envoi email conserve son action et son statut commercial propres. |
| FIS-01 | Préparation fiscale séparée | Les paramètres fiscaux par ligne sont accessibles dans la fiche de facture, pas dans la saisie commerciale. |
| FIS-02 | Sauvegarde explicite | L'utilisateur sauvegarde les paramètres avant la transmission ; les modifications non sauvegardées bloquent le bouton DGI. |
| FIS-03 | Options DGI comme source | Types, groupes et moyens de paiement disponibles proviennent de la réponse DGI ; le backend les revalide. |
| FIS-04 | Cohérence des montants | Le contrôle de concordance Oryxa/DGI et sa tolérance restent appliqués ; aucune désactivation de contrôle n'est autorisée. |
| FIS-05 | Anti-doublon | Les états en cours, inconnus et confirmés bloquent une nouvelle préparation. |
| FIS-06 | Confirmation séparée | La confirmation d'une demande en attente reste une action distincte de sa création. |
| FIS-07 | Preuve fiscale | Les données de confirmation sont visibles et le QR fiscal n'est considéré valide qu'après confirmation DGI. |
| SEC-01 | Protection du jeton | Le jeton DGI reste chiffré côté backend et n'est jamais retourné au frontend. |
| SEC-02 | Environnement test | L'application reste configurée pour l'URL DGI de test ; aucune activation production n'est incluse. |
| REG-01 | Traçabilité | Les erreurs, UID et informations de réponse utiles sont conservés selon le modèle backend existant. |

## 5. Règles métier et contraintes existantes à préserver

- Types de facture utilisés si et seulement si retournés par la DGI : `FV`, `FA`, `EV`, `EA`.
- Un avoir `FA` ou `EA` doit référencer le code MECeF/DGI de la facture originale confirmée, et non le numéro interne Oryxa.
- Les taux AIB A/B sont proposés uniquement si la DGI les retourne.
- Les moyens de paiement déclarés sont choisis parmi ceux retournés par la DGI. Il s'agit du mode de paiement déclaré sur la facture, pas du paiement de l'abonnement Oryxa.
- Les prix sont actuellement traités comme des bases HT. La base TTC n'est pas prise en charge par le modèle actuel.
- Les remises globales restent bloquées dans le flux fiscal tant que leur représentation DGI exacte n'est pas prise en charge.
- La taxe spécifique est enregistrée en montant total par ligne, en FCFA uniquement selon le modèle actuel. Elle entre aussi dans le total TTC commercial Oryxa : toute modification doit être signalée et contrôlée.
- Si `originalPrice` est renseigné, `priceModification` est requis.
- Le contrôle de total compare le montant attendu Oryxa au montant DGI ; la tolérance documentée dans l'intégration actuelle est de 1 FCFA.
- Une réponse réseau ambiguë ou un timeout conduit à l'état `unknown` : ne jamais réessayer par un nouvel envoi sans vérification auprès de la DGI.
- Les états `submitting`, `pending_confirmation`, `confirming`, `cancelling`, `unknown` et `confirmed` doivent continuer à verrouiller les modifications selon les protections backend existantes.

## 6. Statuts à afficher sans les mélanger

**Statut commercial** : brouillon, envoyée, vue, payée, en retard, annulée.  
**Statut fiscal** : non émise, soumission en cours, en attente de confirmation, confirmation en cours, annulation en cours, inconnue, confirmée, erreur, annulée.

Les libellés destinés à l'utilisateur doivent être explicites. Les valeurs techniques peuvent rester visibles dans une zone de détails ou de diagnostic, mais ne doivent pas être le seul texte explicatif.

## 7. Sécurité et conformité

- Garder `EMECEF_TEST_BASE_URL=https://developper.impots.bj/sygmef-emcf` pour la phase de test.
- Garder `EMECEF_ENCRYPTION_KEY` côté backend uniquement ; ne pas la changer après chiffrement de jetons existants.
- Ne jamais exposer un jeton DGI dans `VITE_*`, le navigateur, un log ou le dépôt.
- Ne pas assimiler un test automatisé local à un test DGI réel.
- Ne pas déclarer Oryxa homologué ou autorisé en production sur la seule base de l'intégration logicielle.
- Attendre l'accord écrit de la DGI avant tout usage en production.

## 8. Limite de la première implémentation

La route actuelle de modification de facture n'autorise la modification que des factures commerciales encore au statut `brouillon`. En conséquence, la sauvegarde des paramètres fiscaux par ligne est proposée dans cette phase uniquement pour les brouillons. Si le besoin validé est de fiscaliser une facture déjà envoyée commercialement, une route backend dédiée devra être conçue pour modifier exclusivement les métadonnées fiscales, avec contrôle de propriété, verrouillage atomique des états e-MECeF et tests de concurrence. Il ne faut pas contourner la règle actuelle en réutilisant l'API standard.

Autre point à arbitrer avant usage métier : la taxe spécifique est actuellement intégrée au total TTC commercial. La DGI doit confirmer la nature exacte de ce champ et son traitement attendu ; il ne faut pas l'assimiler automatiquement à une taxe de séjour ou à une taxe particulière donnée.

## 9. Tests d'acceptation

### Interface
- [ ] La création d'une facture ne montre plus les champs DGI par ligne.
- [ ] La fiche de facture présente un bloc « Préparation fiscale » distinct.
- [ ] La modification d'un paramètre affiche un avertissement de non-sauvegarde.
- [ ] Le bouton de transmission DGI est désactivé tant que des modifications fiscales ne sont pas sauvegardées.
- [ ] Le formulaire commercial conserve son aperçu PDF, son enregistrement et son envoi email.
- [ ] Le total de la facture est recalculé et affiché après enregistrement d'une taxe spécifique.

### API et sécurité
- [ ] La sauvegarde des paramètres fiscaux utilise l'API existante seulement sur brouillon.
- [ ] Une facture envoyée ou fiscalement verrouillée ne peut pas être modifiée par cette interface.
- [ ] Les options DGI absentes ou non chargées empêchent l'envoi.
- [ ] Un état `unknown` ou `pending_confirmation` ne déclenche aucune nouvelle soumission.
- [ ] Aucun jeton ni clé de chiffrement n'est exposé côté navigateur.

### DGI
- [ ] Réaliser d'abord un cas simple applicable : une ligne, base HT, sans remise, sans AIB et sans taxe spécifique, avec un groupe cohérent.
- [ ] Contrôler le total DGI et le code de confirmation.
- [ ] Vérifier le QR sur le portail de test DGI.
- [ ] Archiver le PDF et les preuves demandées par la DGI.
- [ ] Étendre aux autres cas uniquement après validation du cas simple et confirmation des règles.

## 10. Plan de déploiement

1. Exécuter `npm ci` puis `npm run typecheck` et `npm run build` dans `frontend`.
2. Exécuter les tests backend existants (`npm test`) sans appeler la DGI réelle.
3. Déployer d'abord sur un environnement de préproduction si disponible.
4. Vérifier l'enregistrement commercial, l'envoi email et la sauvegarde des paramètres fiscaux sur une facture brouillon.
5. Vérifier que le bouton DGI est bloqué en cas de données non sauvegardées ou d'options DGI non disponibles.
6. N'effectuer une transmission réelle de test DGI qu'après validation manuelle du scénario et accord explicite de l'opérateur.
7. Conserver les résultats, réponses et PDF dans le dossier de test.

## 11. Livrables

- `frontend/src/pages/InvoiceForm.tsx` : formulaire commercial débarrassé des champs fiscaux de ligne.
- `frontend/src/pages/InvoiceDetail.tsx` : préparation fiscale par ligne, sauvegarde distincte et bloc e-MECeF conservé.
- `docs/CAHIER_DES_CHARGES_INTERFACE_COMMERCIALE_FISCALE.md` : présent cahier des charges.
- `docs/EMECEF_INTERFACE_CHANGELOG.md` : résumé de la première implémentation et de ses limites.

