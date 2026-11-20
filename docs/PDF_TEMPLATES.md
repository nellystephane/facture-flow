# Modèles PDF (factures, devis, reçus)

Refonte : neuf compositions réellement différentes, plus de QR de paiement.

## Architecture
- `backend/utils/pdfBuilder.js` : construit un **modèle de document** (`documentModel`) à partir de la facture/du devis/du paiement. Aucune mise en page ici.
- `backend/utils/pdf/templates.js` : un modèle = des jetons (polices, couleurs, tableau, totaux) + des hooks de composition (`chrome`, `header`, `parties`).
- `backend/utils/pdf/flow.js` : le flux commun (tableau multipage, totaux, bouton de paiement, sceau fiscal, banque, bon pour accord, notes).
- `backend/utils/pdf/kit.js` : primitives (texte, filets, cadres, lien cliquable).

Modèles : classique, moderne, minimal, atelier, horizon, prestige, corporate, signature, noir. Ajouter un modèle = un objet dans `templates.js` + une entrée dans `config/plans.js` et `frontend/src/components/TemplatePicker.tsx`.

## Paiement
- Le QR de paiement est supprimé. Reste un **bouton « Payer en ligne »** discret (lien cliquable), sous le total, uniquement si la facture est impayée.
- Les coordonnées bancaires sont un bloc typographique, affiché uniquement si impayée.
- Le seul QR restant est le **sceau fiscal DGI** d'une facture normalisée confirmée (QR + code MECeF, NIM, date, compteurs). Il prime visuellement sur le bouton.

## Devis et reçus
- Devis : bloc « Bon pour accord » (date, signature), pas de bouton de paiement.
- Reçu : montant en vedette, cadre « PAYÉ », grille de détails.

## Devises
Montants formatés dans la devise du document ; ₦ → NGN et GH₵ → GHS dans les PDF (polices standard WinAnsi). Facture normalisée : colonnes fiscales en XOF.

## Vérification
Le rendu a été contrôlé via une couche de substitution de pdfkit (pdf-lib) rasterisée, pas avec pdfkit réel. Contrôler visuellement chaque modèle au premier lancement réel (facture, devis, reçu, fiscale, multipage).
