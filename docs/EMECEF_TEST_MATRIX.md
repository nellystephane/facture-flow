# Matrice de tests e-MECeF — couverture étendue

Cette matrice distingue les tests automatiques du logiciel, les essais réels sur la plateforme DGI de test et les tests nécessaires à l'auto-déclaration officielle. Elle ne doit pas être interprétée comme une approbation de la DGI. Les paramètres fiscaux sont maintenant chargés depuis la DGI et revalidés par le backend avant chaque création.

## A. Tests automatiques du logiciel

| Cas | Résultat attendu | Couverture ajoutée |
|---|---|---|
| Jeton chiffré puis déchiffré | Le jeton en clair n'est jamais stocké | `emecefCrypto.test.js` |
| Clé de chiffrement absente/invalide | Erreur explicite | `emecefCrypto.test.js` |
| Jeton chiffré altéré | Déchiffrement refusé | `emecefCrypto.test.js` |
| URL de production / URL externe | Refusée ; test uniquement | `emecefService.test.js` |
| Chemin API externe, traversal ou query string | Refusé avant l'appel HTTP | `emecefService.test.js` |
| Timeout HTTP | Erreur d'incertitude explicite | `emecefService.test.js` |
| Réponses DGI de configuration incomplètes | Refusées même si HTTP 200 | `emecefService.test.js` |
| Facture FV simple, groupe fiscal cohérent | Payload valide, prix transmis TTC | `emecefPayload.test.js` |
| Remise, TVA incohérente, IFU invalide, article invalide | Blocage avant envoi | `emecefPayload.test.js` |
| Paiement `CREDIT` documenté par l'API | Accepté dans le payload | `emecefPayload.test.js` |
| Base TTC dans le modèle actuel | Refus explicite ; Oryxa calcule la TVA à partir des prix HT | `emecefPayload.test.js` |
| Total DGI identique au total attendu | L'état devient `pending_confirmation` | `fiscalisationController.test.js` |
| Groupes fiscaux mixtes ou taxe spécifique créant un écart commercial | Blocage avant appel à la DGI | `emecefPayload.test.js` |
| Type de facture / moyen de paiement non retourné par la DGI | Blocage avant création | `fiscalisationController.test.js` |
| Total DGI différent ou absent | Tentative d'annulation ; aucune confirmation | `fiscalisationController.test.js` |
| Annulation après écart impossible à confirmer | État `unknown`, pas de nouvelle soumission | `fiscalisationController.test.js` |
| Timeout lors de la création | État `unknown`, pas de nouvelle soumission automatique | `fiscalisationController.test.js` |
| Confirmation réussie | Code MECeF/DGI, NIM, date, compteur et QR stockés | `fiscalisationController.test.js` |
| Erreur DGI 20 lors de la confirmation | État `unknown` et vérification requise | `fiscalisationController.test.js` |
| UID encore dans la liste DGI | Rétablissement prudent de `pending_confirmation` | `fiscalisationController.test.js` |
| UID absent de la liste DGI | Reste `unknown` ; aucune conclusion inventée | `fiscalisationController.test.js` |
| Double confirmation/annulation concurrente | Un seul verrou peut être obtenu | `fiscalisationController.test.js` |
| Facture fiscalisée/en cours/incertaine | Modification, suppression et annulation commerciale bloquées | `invoices.test.js`, `invoiceStatusAutomation.test.js` |

## B. Essais manuels obligatoires sur l'environnement DGI de test

À exécuter avec un jeton de test valide, une facture de test identifiable et sans données client réelles inutiles :

1. Tester la connexion et vérifier l'IFU, le NIM et la validité du jeton.
2. Charger les groupes fiscaux, les types de facture et les modes de paiement depuis la DGI.
3. Envoyer une facture FV simple, avec un groupe fiscal qui correspond au taux Oryxa.
4. Comparer `total` DGI au total attendu ; confirmer uniquement si les deux concordent.
5. Vérifier que la réponse de confirmation contient `codeMECeFDGI`, `nim`, `dateTime`, `counters` et `qrCode`.
6. Vérifier une demande en attente puis l'annuler dans l'environnement de test.
7. Simuler une réponse ambiguë/timeout uniquement dans les tests mockés, jamais en provoquant des doublons réels sur la plateforme.
8. Vérifier une facture confirmée sur le portail DGI de vérification : https://developper.impots.bj/sygmef-test/verification.

Ne pas réutiliser une facture ou un UID déjà finalisé pour tester une nouvelle soumission. Le manuel DGI précise que les demandes non finalisées expirent après deux minutes.

## C. État de conformité / limites

La couverture du code a été étendue aux types `FV`, `FA`, `EV`, `EA`, aux groupes fiscaux par ligne, aux quantités décimales, à l'AIB A/B, aux taxes spécifiques, aux références d'avoirs et au QR fiscal DGI dans le PDF après confirmation. Cette couverture de code ne signifie pas que les 20 scénarios ont été acceptés par la plateforme DGI.

Restent à traiter ou à confirmer :
- Le test 11 « taxe de séjour » : l'API v1.0 fournie décrit `taxSpecific`, mais pas de champ distinct ni de règle explicite pour la taxe de séjour. Ne pas assimiler les deux sans confirmation écrite de la DGI.
- Les remises globales restent bloquées, car le payload ne représente pas encore sans ambiguïté la remise au niveau de chaque ligne selon l'API.
- Le mode commercial historique conserve son total global avec un seul taux de TVA. Le nouveau mode `normalisee` calcule les montants par groupe fiscal de ligne, avec arrondi du prix unitaire TTC selon le manuel. Chaque cas doit encore être vérifié sur le portail DGI.
- Les champs `originalPrice` et `priceModification` sont transmis lorsqu'ils existent sur une ligne, mais leur workflow complet d'édition et de validation reste à tester.

Le document d'auto-déclaration DGI exige des exemples de facture et des captures lisibles avec QR scannable, la vérification sur `https://developper.impots.bj/sygmef-test/verification`, l'envoi du dossier à `emecefbenin@finances.bj` et l'attente de l'approbation. Le code ne peut pas marquer ces étapes administratives comme réussies.

## Couverture ajoutée dans cette révision

| Scénario automatisé | Attendu |
|---|---|
| FV simple avec groupe fiscal B | Payload DGI et total de référence calculés |
| EV export | `type: EV` transmis |
| FA / EA | référence originale obligatoire, normalisée sans tirets en 24 caractères |
| AIB | `aib: A` ou `aib: B` transmis uniquement sur sélection explicite |
| Taxe spécifique | `taxSpecific` transmis au niveau de l’article et inclus dans le total attendu |
| Type invalide / référence absente | rejet local avant appel à la DGI |
| Confirmation DGI | les éléments de sécurité restent enregistrés dans `fiscalisation` |
| PDF fiscal | le QR fiscal DGI est dessiné séparément du QR de paiement uniquement après confirmation et présence du code DGI |

**Limites à ne pas masquer :** les scénarios de la matrice nécessitent encore l’exécution de Jest et de la plateforme DGI de test. Les taxes spécifiques et les groupes fiscaux mélangés nécessitent une vérification métier sur les totaux réels de la DGI ; le payload accepte maintenant des groupes par ligne, mais les scénarios réels doivent confirmer les arrondis et montants. Les remises globales restent bloquées. Le document commercial ne doit pas être présenté comme homologué avant la validation formelle de la DGI.


## Point bloquant documentaire à lever avec la DGI

Le scénario 11 de l'annexe 2 exige une **taxe de séjour**. L'API v1.0 fournie décrit `taxSpecific` comme montant de taxe spécifique par ligne, mais ne documente pas de champ distinct `taxe de séjour` ni une règle d'équivalence explicite. Le logiciel ne doit pas assimiler automatiquement les deux sans confirmation de la DGI. Ce scénario reste donc **à clarifier et à valider**, pas marqué comme réussi.

Les tests 1 à 20 sont des exemples indicatifs de déclaration, pas une suite automatisée exécutable directement. Les payloads couverts par les tests unitaires locaux ne remplacent ni la création/confirmation réelle sur la plateforme de test, ni la vérification de chaque facture sur `https://developper.impots.bj/sygmef-test/verification`, ni les captures lisibles demandées dans le formulaire d'auto-déclaration.


## Corrections de sécurité de cohérence ajoutées dans la révision

- Les groupes fiscaux mixtes et les taxes spécifiques ne contournent plus le rapprochement entre le total commercial et le total fiscal calculé : tout écart supérieur à 1 FCFA bloque la création avant l'appel POST.
- Le backend charge maintenant l'ensemble des options de la DGI et vérifie que le type de facture et le moyen de paiement choisis sont effectivement proposés pour le compte de test.
- Le backend compare l'IFU retourné par le statut DGI à l'IFU configuré dans Oryxa lorsqu'il est présent.
- L'interface de facture affiche les types, groupes fiscaux, taux et moyens de paiement obtenus depuis la DGI ; elle bloque l'envoi si ces options ne sont pas chargées.
- Une modification de prix exige désormais le prix d'origine et son motif.

Cette correction privilégie la cohérence des montants : elle peut refuser certains scénarios mixtes ou avec taxe spécifique tant que le total commercial Oryxa ne représente pas exactement le total fiscal. Ce refus est volontaire et préférable à l'émission d'une facture DGI différente du document client.


## Mise à jour du 20 novembre 2026 — mode normalisé à la création

Le formulaire distingue désormais `commerciale` et `normalisee`. En mode normalisé, les groupes et taux sont chargés depuis les options DGI, les paramètres sont saisis par ligne et le calcul TTC est fait ligne par ligne. Le test mixte A/B 2 × 1 000 FCFA + 3 × 1 000 FCFA à 18 % est attendu à 5 540 FCFA. La taxe spécifique reste distincte et facultative ; elle n'est pas déduite automatiquement du groupe fiscal. Voir `IMPLEMENTATION_MODE_FACTURE_NORMALISEE.md`. Les tests locaux ajoutés ne remplacent pas les essais réels DGI et la validation écrite.
