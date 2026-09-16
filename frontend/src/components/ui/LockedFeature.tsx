import { Link } from 'react-router-dom';
import { Lock, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

interface LockedFeatureProps {
  icon?: ReactNode;
  titre: string;
  description: string;
  planRequis?: 'Pro' | 'Business';
  compact?: boolean;
}

export default function LockedFeature({ icon, titre, description, planRequis = 'Pro', compact = false }: LockedFeatureProps) {
  if (compact) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 bg-white shrink-0">
          <Lock size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0a0a0c]">{titre}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <Link to="/app/abonnement" className="btn-ghost text-xs shrink-0 py-1.5">
          <Zap size={12} /> {planRequis}
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 text-center animate-scale-in">
      <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-gray-400 bg-gray-100 mb-4">
        {icon || <Lock size={24} />}
      </div>
      <h3 className="text-lg font-bold text-[#0a0a0c]">{titre}</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">{description}</p>
      <p className="text-xs text-gray-400 mt-3">Disponible avec {planRequis}.</p>
      <Link to="/app/abonnement" className="btn-primary mt-5 inline-flex">
        <Zap size={16} /> Passer à {planRequis}
      </Link>
    </div>
  );
}
