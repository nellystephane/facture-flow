import { useEffect, useState, useRef } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

/**
 * Enregistre le service worker (généré par vite-plugin-pwa au build) et
 * affiche une bannière lorsqu'une nouvelle version de l'app est disponible.
 * On ne recharge JAMAIS automatiquement : un rechargement surprise pendant
 * la saisie d'une facture ferait perdre le travail en cours à l'utilisateur.
 */
export default function PwaUpdatePrompt() {
  const { toast } = useToast();
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Import dynamique : ce module virtuel n'existe qu'après `vite build`
    // avec vite-plugin-pwa. En dev (devOptions.enabled: false), il n'y a pas
    // de service worker et cet import est simplement ignoré.
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return;
        const update = registerSW({
          immediate: true,
          onNeedRefresh() {
            setNeedRefresh(true);
          },
          onOfflineReady() {
            toast('Application installée : elle fonctionnera aussi hors-ligne 📴');
          },
        });
        updateRef.current = update;
      })
      .catch(() => {
        // Pas de service worker disponible (ex: dev local) — silencieux.
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] animate-fade-up">
      <div className="glass-card px-4 py-3 flex items-center gap-3 shadow-lg">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ background: 'linear-gradient(135deg,#e11d2a,#b3121d)' }}>
          <RefreshCw size={16} />
        </div>
        <p className="text-sm font-medium text-[#0a0a0c]">Nouvelle version de FactuFlow disponible</p>
        <button
          onClick={() => updateRef.current?.(true)}
          className="btn-primary !py-1.5 !px-3 text-sm"
        >
          Mettre à jour
        </button>
        <button onClick={() => setNeedRefresh(false)} className="text-gray-400 hover:text-gray-700">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
