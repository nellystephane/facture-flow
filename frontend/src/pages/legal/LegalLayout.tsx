import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import OryxaLogo from '../../components/OryxaLogo';
import { useEffect, useState, type ReactNode } from 'react';
import api from '../../api/axiosConfig';

interface Surcharge {
  titre: string;
  contenu: string;
}

// Rend un contenu texte simple admin-édité : les lignes commençant par
// "# " deviennent des titres, les lignes vides séparent les paragraphes.
// Volontairement pas de HTML pour ne jamais risquer d'injection de script
// depuis la page admin.
function RenduTexteSimple({ texte }: { texte: string }) {
  const blocs = texte.split(/\n{2,}/);
  return (
    <>
      {blocs.map((bloc, i) => {
        const ligne = bloc.trim();
        if (ligne.startsWith('# ')) {
          return <h2 key={i} className="text-lg font-bold text-[#0a0a0c] dark:text-white mt-2">{ligne.slice(2)}</h2>;
        }
        return <p key={i} className="whitespace-pre-line">{ligne}</p>;
      })}
    </>
  );
}

export default function LegalLayout({
  slug, title, updated, children,
}: {
  slug: 'cgu' | 'confidentialite' | 'mentions-legales';
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const [surcharge, setSurcharge] = useState<Surcharge | null>(null);

  useEffect(() => {
    api.get(`/public/legal/${slug}`)
      .then((res) => {
        if (res.data?.contenu) setSurcharge({ titre: res.data.titre, contenu: res.data.contenu });
      })
      .catch(() => {}); // pas de surcharge = contenu par défaut, silencieusement
  }, [slug]);

  return (
    <div className="app-bg min-h-screen py-10 px-4">
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div className="relative max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#0a0a0c] dark:hover:text-white">
            <ArrowLeft size={16} /> Retour à l'accueil
          </Link>
          <OryxaLogo size={26} nameClassName="font-bold text-sm text-[#0a0a0c] dark:text-white" imageClassName="rounded-md" className="opacity-80" />
        </div>

        <div className="glass-card p-6 md:p-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#0a0a0c] dark:text-white mb-1">
            {surcharge?.titre || title}
          </h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-8">Dernière mise à jour : {updated}</p>
          <div className="legal-content text-sm leading-relaxed text-gray-600 dark:text-gray-400 space-y-5">
            {surcharge ? <RenduTexteSimple texte={surcharge.contenu} /> : children}
          </div>
        </div>
      </div>
    </div>
  );
}
