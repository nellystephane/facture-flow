# Évolution interface commerciale / fiscale — phase 1

## Modifications réalisées

- Retrait du formulaire de création/modification commerciale des champs DGI par ligne : groupe fiscal, taxe spécifique, prix d'origine et motif de modification.
- Ajout d'un texte d'orientation dans la zone Articles indiquant où retrouver les paramètres fiscaux après enregistrement.
- Ajout dans la fiche facture d'un bloc autonome « Préparation fiscale » avec paramètres par ligne.
- Ajout d'une sauvegarde explicite des paramètres fiscaux via `PUT /api/invoices/:id`.
- Désactivation de l'action de transmission DGI lorsque les paramètres fiscaux sont modifiés mais non sauvegardés.
- Avertissement visible indiquant que `taxSpecific` entre actuellement dans le total TTC commercial Oryxa.
- Maintien du flux e-MECeF existant : options DGI, préparation, confirmation, annulation, vérification de statut et gestion des états incertains.

## Limites connues

- La sauvegarde fiscale par ligne est limitée aux factures au statut `brouillon`, conformément au contrôleur backend existant. Une évolution backend séparée est nécessaire pour autoriser une fiscalisation après envoi commercial.
- Le total TTC est modifié si une taxe spécifique est renseignée, car le calcul existant inclut déjà cette valeur. Le traitement exact de cette taxe doit être confirmé auprès de la DGI.
- Les champs DGI historiques restent présents dans les données existantes et sont préservés lors du chargement des factures ; ils ne sont plus saisis dans le formulaire commercial.
- Cette modification ne lance aucun appel DGI et ne vaut ni validation DGI ni homologation.

## Vérifications à effectuer

- `cd frontend && npm ci && npm run typecheck && npm run build`
- `cd backend && npm ci && npm test`
- Parcours manuel sur facture brouillon avec sauvegarde puis contrôle des totaux.
- Test DGI uniquement après validation manuelle du cas simple et décision explicite de l'opérateur.
