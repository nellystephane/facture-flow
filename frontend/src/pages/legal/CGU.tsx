import LegalLayout from './LegalLayout';

const h2 = 'text-lg font-bold text-[#0a0a0c] mt-2';
const ul = 'list-disc pl-5 space-y-1.5';

export default function CGU() {
  return (
    <LegalLayout title="Conditions Générales d'Utilisation" updated="[à compléter — ex. 12 août 2026]">
      <p className="text-xs italic text-gray-400 bg-gray-50 rounded-lg p-3">
        Modèle de départ à faire relire par un professionnel du droit avant toute exploitation commerciale réelle,
        en particulier parce que FactuFlow encaisse des paiements pour le compte de tiers. Remplacez les mentions
        entre crochets [ainsi] par vos informations réelles.
      </p>

      <section>
        <h2 className={h2}>1. Objet</h2>
        <p>
          Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de l'application
          FactuFlow (ci-après « le Service »), éditée par [Nom de l'entreprise / de l'exploitant], permettant à ses
          utilisateurs (ci-après « l'Utilisateur ») de créer des devis et factures, gérer des clients, et encaisser
          des paiements auprès de leurs propres clients.
        </p>
      </section>

      <section>
        <h2 className={h2}>2. Acceptation</h2>
        <p>
          L'inscription au Service vaut acceptation pleine et entière des présentes CGU. Si l'Utilisateur n'accepte
          pas tout ou partie des présentes conditions, il ne doit pas utiliser le Service.
        </p>
      </section>

      <section>
        <h2 className={h2}>3. Description du Service</h2>
        <p>Le Service permet notamment de :</p>
        <ul className={ul}>
          <li>Créer, envoyer et suivre des devis et factures ;</li>
          <li>Gérer une base de clients et de tarifs ;</li>
          <li>Recevoir des paiements en ligne (Mobile Money, carte, virement) via le prestataire FedaPay ;</li>
          <li>Générer des documents PDF et des reçus de paiement.</li>
        </ul>
        <p className="mt-2">
          Le Service est proposé selon plusieurs formules d'abonnement (Gratuit, Pro, Business) dont le détail et les
          tarifs sont consultables dans l'application. L'éditeur se réserve le droit de faire évoluer les
          fonctionnalités de chaque formule, avec un préavis raisonnable en cas de réduction d'avantages sur un
          abonnement payant en cours.
        </p>
      </section>

      <section>
        <h2 className={h2}>4. Compte utilisateur</h2>
        <p>
          L'Utilisateur est responsable de la confidentialité de son mot de passe et de toute activité réalisée
          depuis son compte. Il s'engage à fournir des informations exactes lors de son inscription et à les tenir à
          jour. Toute suspicion d'utilisation frauduleuse doit être signalée sans délai à [email de contact].
        </p>
      </section>

      <section>
        <h2 className={h2}>5. Paiements en ligne et abonnements</h2>
        <p>
          Les paiements (abonnements, et paiements de factures reçus par l'Utilisateur de la part de ses propres
          clients) sont traités par le prestataire tiers FedaPay. L'éditeur du Service n'a pas accès aux données
          bancaires ou de carte des payeurs et n'est pas responsable des éventuels dysfonctionnements du prestataire
          de paiement, sans préjudice du droit de l'Utilisateur de faire valoir ses droits directement auprès de
          celui-ci.
        </p>
        <p className="mt-2">
          Les abonnements payants (Pro, Business) sont sans engagement de durée sauf mention contraire au moment de
          la souscription et se renouvellent selon la périodicité choisie. L'Utilisateur peut résilier à tout moment
          depuis son espace « Abonnement » ; la résiliation prend effet à la fin de la période déjà payée, sans
          remboursement au prorata sauf disposition légale impérative contraire.
        </p>
      </section>

      <section>
        <h2 className={h2}>6. Responsabilité de l'Utilisateur sur le contenu de ses documents</h2>
        <p>
          L'Utilisateur est seul responsable de l'exactitude, de la licéité et de la conformité fiscale/comptable des
          devis, factures et informations qu'il saisit dans le Service, y compris vis-à-vis de ses propres clients et
          des administrations compétentes. Le Service est un outil de gestion et ne constitue ni un conseil
          comptable, ni un conseil fiscal, ni un conseil juridique.
        </p>
      </section>

      <section>
        <h2 className={h2}>7. Disponibilité du Service</h2>
        <p>
          L'éditeur s'efforce d'assurer un accès continu au Service mais ne garantit pas une disponibilité
          ininterrompue (maintenance, panne, cas de force majeure, indisponibilité des prestataires tiers
          d'hébergement, d'email ou de paiement). Aucune indemnisation n'est due au titre d'une indisponibilité
          temporaire, sauf disposition légale impérative contraire.
        </p>
      </section>

      <section>
        <h2 className={h2}>8. Résiliation</h2>
        <p>
          L'Utilisateur peut cesser d'utiliser le Service et demander la suppression de son compte à tout moment (cf.
          Politique de confidentialité). L'éditeur peut suspendre ou résilier l'accès d'un Utilisateur en cas de
          manquement grave aux présentes CGU (fraude, usage illicite, impayé d'abonnement persistant), après mise en
          demeure restée infructueuse lorsque la situation le permet.
        </p>
      </section>

      <section>
        <h2 className={h2}>9. Modification des CGU</h2>
        <p>
          Les présentes CGU peuvent être modifiées à tout moment. La version en vigueur est celle publiée sur cette
          page, avec sa date de mise à jour. En cas de modification substantielle, les utilisateurs actifs en seront
          informés par email ou par une notification dans l'application.
        </p>
      </section>

      <section>
        <h2 className={h2}>10. Droit applicable</h2>
        <p>
          Les présentes CGU sont soumises au droit [pays à préciser, ex. béninois]. Tout litige sera soumis, à
          défaut de résolution amiable, aux tribunaux compétents du ressort de [ville/juridiction à préciser].
        </p>
      </section>

      <section>
        <h2 className={h2}>Contact</h2>
        <p>Pour toute question relative aux présentes CGU : [email de contact].</p>
      </section>
    </LegalLayout>
  );
}
