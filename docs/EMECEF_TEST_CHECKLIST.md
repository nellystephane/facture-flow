# Checklist opérationnelle e-MECeF — essais Oryxa / DGI

**Environnement :** DGI développeur / test uniquement  
**Portail de vérification :** https://developper.impots.bj/sygmef-test/verification  
**Ne jamais utiliser un token de production dans cette procédure.**

## A. Préparation technique

- [ ] Déployer la version backend et frontend de la même livraison.
- [ ] Définir `EMECEF_TEST_BASE_URL=https://developper.impots.bj/sygmef-emcf` dans l'environnement backend.
- [ ] Générer `EMECEF_ENCRYPTION_KEY` (32 octets / 64 caractères hexadécimaux) et la définir côté backend.
- [ ] Vérifier que `EMECEF_ENCRYPTION_KEY` est identique sur toutes les instances backend.
- [ ] Vérifier `/api/health` et la connexion MongoDB.
- [ ] Vérifier que l'origine frontend est autorisée dans `CLIENT_URL`.
- [ ] Ne pas mettre de token DGI dans le frontend ou dans Git.

## B. Configuration DGI dans Oryxa

- [ ] Se connecter avec un compte propriétaire ou administrateur.
- [ ] Ouvrir Profil → e-MECeF — environnement de test.
- [ ] Saisir l'IFU vendeur de test (13 chiffres).
- [ ] Saisir le nom de l'opérateur.
- [ ] Saisir le token DGI de test.
- [ ] Enregistrer la configuration.
- [ ] Tester la connexion.
- [ ] Vérifier que la réponse indique une connexion réussie et, si communiqué, le NIM.
- [ ] Ouvrir une facture et attendre le chargement des paramètres DGI.
- [ ] Vérifier les types de facture, groupes/taux et moyens de paiement affichés.
- [ ] Vérifier que l'IFU DGI retourné correspond à l'IFU configuré.

## C. Parcours nominal — première facture FV

Utiliser une facture de test distincte, sans remise, AIB ni taxe spécifique, avec un seul groupe fiscal dont le taux correspond à la TVA globale de la facture Oryxa.

- [ ] Créer un client de test.
- [ ] Créer une facture brouillon avec une ligne et une quantité simple.
- [ ] Choisir le groupe fiscal correspondant au taux commercial.
- [ ] Vérifier le total TTC Oryxa.
- [ ] Dans e-MECeF, choisir FV et un mode de paiement réellement retourné par la DGI.
- [ ] Envoyer une seule fois.
- [ ] Vérifier l'UID et le total calculé par la DGI.
- [ ] Confirmer uniquement si le total DGI correspond au total attendu.
- [ ] Vérifier le code MECeF/DGI, le NIM, la date/heure, le compteur et le QR code.
- [ ] Télécharger le PDF et contrôler les données de sécurité.
- [ ] Scanner le QR et vérifier le document sur le portail DGI.
- [ ] Archiver les captures et le PDF comme preuve du scénario.

## D. Annulation d'une demande en attente

À exécuter avec une autre facture de test, non confirmée.

- [ ] Préparer une FV.
- [ ] Vérifier qu'elle est `pending_confirmation`.
- [ ] Cliquer sur « Annuler la demande de test ».
- [ ] Vérifier que la DGI confirme l'annulation et qu'Oryxa affiche `cancelled`.
- [ ] Ne jamais réutiliser le même UID pour un nouvel essai.

## E. Autres scénarios applicables

N'exécuter un scénario que si le type et les options sont proposés par la DGI et que les règles de calcul sont documentées.

- [ ] Groupes fiscaux A à F applicables au compte de test.
- [ ] Quantités décimales, si prévues par le cas DGI.
- [ ] AIB A et B : vérifier le taux retourné et comparer la réponse détaillée DGI avant de valider le montant.
- [ ] Taxe spécifique : vérifier que le total commercial Oryxa intègre bien cette taxe avant envoi.
- [ ] Groupes fiscaux mixtes : le total commercial doit correspondre au total fiscal calculé, sinon Oryxa bloque l'envoi.
- [ ] EV : uniquement si proposé par la DGI et avec les données export requises.
- [ ] FA : utiliser uniquement le code MECeF/DGI d'une facture originale confirmée.
- [ ] EA : utiliser uniquement si proposé et avec une référence originale valide.

**Cas 11 — taxe de séjour :** ne pas le marquer réussi et ne pas assimiler `taxSpecific` à la taxe de séjour sans confirmation écrite de la DGI.

## F. Gestion des incidents — règles impératives

- [ ] En cas de timeout, état `unknown` : ne pas cliquer de nouveau sur Envoyer.
- [ ] Vérifier l'UID dans Swagger / auprès de la DGI avant toute action.
- [ ] Si le total DGI diffère, Oryxa doit tenter l'annulation et bloquer la confirmation.
- [ ] Si l'annulation est incertaine, ne pas renvoyer la facture.
- [ ] Si un UID n'apparaît plus dans les demandes en attente, ne pas supposer qu'il est annulé ou confirmé.
- [ ] Ne jamais modifier/supprimer une facture confirmée ou dont l'état est incertain.
- [ ] Pour corriger une facture confirmée, suivre le parcours d'avoir autorisé par la DGI.

## G. Constitution du dossier d'homologation

Pour chaque cas exigé et applicable dans le formulaire officiel :

- [ ] Capture de la facture Oryxa avant fiscalisation.
- [ ] Capture du résultat DGI après confirmation.
- [ ] PDF fiscalisé lisible.
- [ ] QR scanné et résultat du portail de vérification.
- [ ] Montants, libellés, taxes, identifiants et mentions de sécurité comparés.
- [ ] Cas non applicable identifié et justifié.
- [ ] Dossier transmis à `emecefbenin@finances.bj` selon la procédure officielle.
- [ ] Attendre l'accord formel DGI avant de passer en production.

Cette checklist organise les essais ; elle ne remplace pas le formulaire officiel ni la décision d'homologation de la DGI.
