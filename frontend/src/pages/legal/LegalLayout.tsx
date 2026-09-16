import { Link } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

export default function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="app-bg min-h-screen py-10 px-4">
      <div className="orb orb-1" /><div className="orb orb-2" />
      <div className="relative max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#0a0a0c]">
            <ArrowLeft size={16} /> Retour à l'accueil
          </Link>
          <div className="flex items-center gap-2 opacity-70">
            <Zap size={16} className="text-[#d9524d]" fill="currentColor" />
            <span className="font-bold text-sm text-[#0a0a0c]">FactuFlow</span>
          </div>
        </div>

        <div className="glass-card p-6 md:p-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#0a0a0c] mb-1">{title}</h1>
          <p className="text-xs text-gray-400 mb-8">Dernière mise à jour : {updated}</p>
          <div className="legal-content text-sm leading-relaxed text-gray-600 space-y-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
