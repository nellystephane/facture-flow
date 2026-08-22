import LegalLayout from './LegalLayout';

const h2 = 'text-lg font-bold text-[#0a0a0c] mt-2';
const ul = 'list-disc pl-5 space-y-1.5';

export default function Confidentialite() {
  return (
    <LegalLayout title="Politique de confidentialité" updated="[à compléter — ex. 12 août 2026]">
      <p className="text-xs italic text-gray-400 bg-gray-50 rounded-lg p-3">
        Modèle de départ à faire relire par un professionnel avant exploitation commerciale réelle, en particulier
        pour vérifier sa conformité aux règles de protection des données applicables à vos utilisateurs (RGPD si vous
        avez des utilisateurs en Europe, loi locale sur la protection des données personnelles le cas échéant).
        Remplacez les mentions entre crochets par vos informations réelles.
      </p>

      <section>
        <h2 className={h2}>1. Qui sommes-nous</h2>
        <p>
          FactuFlow est édité par [Nom de l'entreprise / de l'exploitant], [adresse], joignable à [email de contact].
          Cette politique explique quelles données sont collectées lorsque vous utilisez l'application, pourquoi, et
          comment les exercer vos droits sur celles-ci.
        </p>
      </section>

      <section>
        <h2 className={h2}>2. Données que nous collectons</h2>
        <p><strong>À l'inscription et dans votre profil :</strong></p>
        <ul className={ul}>
          <li>Nom, adresse email, mot de passe (stocké chiffré, jamais en clair) ;</li>
          <li>Informations d'entreprise facultatives : raison sociale, téléphone, adresse, devise, logo, coordonnées bancaires ;</li>
        </ul>
        <p className="mt-2"><strong>Dans le cadre de l'utilisation du Service :</strong></p>
        <ul className={ul}>
          <li>Données de vos clients que vous saisissez vous-même (nom, email, téléphone, adresse) — vous êtes responsable de leur collecte licite, voir section 6 ;</li>
          <li>Contenu de vos devis, factures et tarifs (montants, descriptions de prestations, statuts) ;</li>
          <li>Historique des paiements associés à vos factures (montant, méthode, statut — les données bancaires elles-mêmes transitent uniquement chez notre prestataire de paiement, voir section 3) ;</li>
        </ul>
        <p className="mt-2"><strong>Données techniques :</strong></p>
        <ul className={ul}>
          <li>Un jeton de connexion (JWT) stocké dans le stockage local de votre navigateur, qui vous maintient connecté ;</li>
          <li>Journaux techniques standards du serveur (horodatage, adresse IP, erreurs) à des fins de sécurité et de diagnostic.</li>
        </ul>
        <p className="mt-2">
          FactuFlow n'utilise pas de cookies publicitaires ni de traceurs tiers à des fins de suivi marketing.
        </p>
      </section>

      <section>
        <h2 className={h2}>3. Sous-traitants et destinataires des données</h2>
        <p>Pour fonctionner, FactuFlow fait appel aux prestataires suivants, qui traitent des données pour notre compte :</p>
        <ul className={ul}>
          <li><strong>Hébergement de la base de données</strong> — MongoDB Atlas ;</li>
          <li><strong>Hébergement du serveur applicatif</strong> — Render ;</li>
          <li><strong>Hébergement du site (frontend)</strong> — GitHub Pages ;</li>
          <li><strong>Envoi d'emails transactionnels</strong> (confirmation de compte, factures, reçus) — Brevo ;</li>
          <li><strong>Paiement en ligne</strong> (Mobile Money, carte, virement) — FedaPay, qui traite directement les données de paiement ; FactuFlow n'a jamais accès aux numéros de carte ou identifiants Mobile Money.</li>
        </ul>
        <p className="mt-2">
          Ces prestataires n'utilisent vos données que pour exécuter le service demandé et n'sont pas autorisés à les
          réutiliser à d'autres fins.
        </p>
      </section>

      <section>
        <h2 className={h2}>4. Pourquoi nous traitons ces données</h2>
        <ul className={ul}>
          <li>Fournir et faire fonctionner le Service (créer vos documents, gérer votre compte) ;</li>
          <li>Vous authentifier et sécuriser votre compte (code de confirmation, mot de passe oublié) ;</li>
          <li>Traiter vos paiements d'abonnement et ceux que vous recevez de vos clients ;</li>
          <li>Vous envoyer les emails nécessaires au fonctionnement du Service (jamais de prospection sans consentement) ;</li>
          <li>Assurer la sécurité et prévenir la fraude.</li>
        </ul>
      </section>

      <section>
        <h2 className={h2}>5. Durée de conservation</h2>
        <p>
          Vos données sont conservées tant que votre compte est actif. Les documents de facturation (factures, devis
          acceptés) peuvent être conservés au-delà de la clôture du compte pendant la durée légale de conservation
          des documents comptables applicable dans votre pays [durée à préciser, ex. 10 ans], car ce sont des
          documents à valeur légale que nous ne pouvons pas supprimer librement à votre demande une fois émis.
        </p>
      </section>

      <section>
        <h2 className={h2}>6. Vos données clients : vous êtes responsable de traitement</h2>
        <p>
          Lorsque vous saisissez des informations sur vos propres clients dans FactuFlow, vous en êtes le responsable
          de traitement : il vous appartient de vous assurer que vous avez le droit de collecter et traiter ces
          données (par exemple parce qu'elles sont nécessaires à l'exécution d'un contrat commercial). FactuFlow agit
          alors en tant que sous-traitant technique, se contentant d'héberger et de traiter ces données pour exécuter
          les instructions données via l'application.
        </p>
      </section>

      <section>
        <h2 className={h2}>7. Vos droits</h2>
        <p>Vous pouvez à tout moment :</p>
        <ul className={ul}>
          <li>Consulter et corriger vos informations depuis la page « Mon profil » ;</li>
          <li>Demander l'export de vos données ;</li>
          <li>Demander la suppression de votre compte et de vos données, sous réserve de la conservation légale des documents comptables mentionnée en section 5 ;</li>
        </ul>
        <p className="mt-2">en écrivant à [email de contact].</p>
      </section>

      <section>
        <h2 className={h2}>8. Sécurité</h2>
        <p>
          Les mots de passe sont stockés chiffrés (jamais en clair). Les échanges avec l'application sont chiffrés
          (HTTPS). L'accès aux données est limité à ce qui est strictement nécessaire au fonctionnement du Service.
          Aucun système n'étant infaillible, nous vous invitons à utiliser un mot de passe unique et robuste.
        </p>
      </section>

      <section>
        <h2 className={h2}>9. Modifications</h2>
        <p>
          Cette politique peut être mise à jour ; la date en haut de page indique la dernière révision. En cas de
          changement substantiel, les utilisateurs actifs seront informés.
        </p>
      </section>

      <section>
        <h2 className={h2}>Contact</h2>
        <p>Pour toute question relative à vos données personnelles : [email de contact].</p>
      </section>
    </LegalLayout>
  );
}
