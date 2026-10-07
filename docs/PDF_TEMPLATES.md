# Modèles PDF Oryxa

Oryxa conserve **Classique** comme modèle par défaut et comme seul modèle du plan Gratuit.

Les plans **Pro** et **Business** disposent des neuf modèles suivants, utilisables aussi bien pour les factures que pour les devis :

- **Classique** — référence Oryxa, sobre et universelle.
- **Moderne** — composition structurée avec en-tête visuel et hiérarchie contemporaine.
- **Minimal** — typographie légère, lignes fines et espaces généreux.
- **Atelier** — composition éditoriale chaleureuse, avec bloc client élargi.
- **Horizon** — mise en page aérée avec carte latérale et accents distinctifs.
- **Prestige** — en-tête sombre et contraste haut de gamme.
- **Corporate** — présentation institutionnelle, dense mais très lisible.
- **Signature** — identité éditoriale raffinée, avec cartes et accents doux.
- **Noir** — contraste fort et présence visuelle premium.

## Prévisualisation

Le sélecteur de modèle est présent dans la création/modification des **factures et devis**. Le bouton d'aperçu utilise le même moteur PDF que le document final : le rendu aperçu est donc le rendu réellement envoyé ou téléchargé.

## Paiement dans les factures

Lorsqu'un lien de paiement public est disponible, la facture contient :

- un bouton **Payer en ligne** cliquable ;
- un QR code cliquable encodant exactement le même lien ;
- une présentation réservée dans une carte dédiée afin que le QR ne chevauche jamais le bouton, les totaux, les notes ou le pied de page.

Le PDF ne contient **aucun domaine codé en dur**. Le lien est construit côté serveur depuis `CLIENT_URL_PUBLIC` (avec repli sur `CLIENT_URL`). Pour passer plus tard sur un domaine personnalisé, il suffit donc de mettre à jour la variable publique côté backend sans modifier les templates PDF.

Le lien de paiement reste également indépendant des liens envoyés par email ou WhatsApp : l'ajout du QR ne remplace ni ne supprime ces canaux.
