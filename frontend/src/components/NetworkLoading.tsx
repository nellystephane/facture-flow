import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/** Indicateur réseau global : discret et non bloquant. */
export default function NetworkLoading() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onLoading = (event: Event) => {
      const detail = (event as CustomEvent<{ loading?: boolean }>).detail;
      setLoading(Boolean(detail?.loading));
    };

    window.addEventListener('oryxa:network-loading', onLoading);
    return () => window.removeEventListener('oryxa:network-loading', onLoading);
  }, []);

  if (!loading) return null;

  return (
    <div className="network-loading" role="status" aria-live="polite" aria-label="Chargement en cours">
      <div className="network-loading__bar" />
      <div className="network-loading__pill">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        <span>Chargement…</span>
      </div>
    </div>
  );
}
