import LegalLayout from './LegalLayout';

const h2 = 'text-lg font-bold text-[#0a0a0c] mt-2';

export default function MentionsLegales() {
  return (
    <LegalLayout title="Mentions légales" updated="[à compléter — ex. 12 août 2026]">
      <p className="text-xs italic text-gray-400 bg-gray-50 rounded-lg p-3">
        Page à compléter avec votre identité réelle avant mise en ligne définitive : ces mentions sont obligatoires
        dès qu'un site édite du contenu ou encaisse des paiements. Si vous exploitez FactuFlow en tant qu'entreprise
        individuelle ou société, indiquez votre numéro d'identification fiscale/registre du commerce (ex. IFU au
        Bénin) une fois celui-ci obtenu.
      </p>

      <section>
        <h2 className={h2}>Éditeur du site</h2>
        <p>
          [Nom de l'entreprise ou de l'exploitant individuel]<br />
          [Statut juridique — ex. Entreprise individuelle / SARL]<br />
          [Numéro IFU / registre du commerce, si applicable]<br />
          [Adresse]<br />
          [Ville, pays]<br />
          Email : [email de contact]<br />
          Téléphone : [téléphone, optionnel]
        </p>
      </section>

      <section>
        <h2 className={h2}>Directeur de la publication</h2>
        <p>[Nom du responsable de la publication]</p>
      </section>

      <section>
        <h2 className={h2}>Hébergement</h2>
        <p>
          <strong>Application (backend / API)</strong> — Render<br />
          <strong>Site (frontend)</strong> — GitHub Pages, un service de GitHub, Inc.<br />
          <strong>Base de données</strong> — MongoDB Atlas
        </p>
      </section>

      <section>
        <h2 className={h2}>Prestataires tiers</h2>
        <p>
          Envoi d'emails transactionnels : Brevo. Paiement en ligne (Mobile Money, carte, virement) : FedaPay. Le
          détail des données transmises à ces prestataires figure dans notre{' '}
          <a href="/confidentialite" className="text-[#d9524d] font-medium hover:underline">Politique de confidentialité</a>.
        </p>
      </section>

      <section>
        <h2 className={h2}>Propriété intellectuelle</h2>
        <p>
          L'application FactuFlow (interface, code, marque, logo) est la propriété de [Nom de l'entreprise /
          exploitant], sauf mention contraire. Toute reproduction non autorisée est interdite. Les documents (devis,
          factures) que vous générez avec le Service, ainsi que leur contenu, vous appartiennent.
        </p>
      </section>

      <section>
        <h2 className={h2}>Contact</h2>
        <p>Pour toute question : [email de contact].</p>
      </section>
    </LegalLayout>
  );
}
