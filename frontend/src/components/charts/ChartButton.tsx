import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import ChartModal from './ChartModal';
import type { AnalyticsSource, Period } from '../../api/analytics';

interface ChartButtonProps {
  /** Éléments proposés d'office dans le graphique (identifiants du catalogue d'analyse). */
  metrics: string[];
  title?: string;
  period?: Period;
  /** Affiche un libellé à côté de l'icône. */
  label?: string;
  className?: string;
  source?: AnalyticsSource;
}

/** Bouton « graphique » : ouvre le modal d'analyse, avec le choix libre des éléments. */
export default function ChartButton({ metrics, title, period, label, className = '', source }: ChartButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={label ? `btn-ghost text-sm ${className}` : `btn-icon ${className}`}
        title="Voir en graphique"
        aria-label={label || 'Voir en graphique'}
      >
        <BarChart3 size={label ? 16 : 18} />
        {label}
      </button>
      {open && <ChartModal onClose={() => setOpen(false)} initialMetrics={metrics} title={title} initialPeriod={period} source={source} />}
    </>
  );
}
