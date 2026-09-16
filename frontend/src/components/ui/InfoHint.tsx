import { useState } from 'react';
import { Info } from 'lucide-react';

/**
 * Petite bulle d'aide contextuelle. Cliquer sur le "!" affiche une explication
 * courte — utile pour les notions qui ne sont pas évidentes au premier coup
 * d'œil (page de paiement, abonnements, fonctionnalités premium...).
 */
export default function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle ml-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Aide"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#d9524d]/10 text-[#d9524d] hover:bg-[#d9524d]/20 transition-colors"
      >
        <Info size={11} strokeWidth={2.5} />
      </button>
      {open && (
        <span className="absolute z-20 left-1/2 -translate-x-1/2 top-6 w-64 p-3 rounded-xl bg-[#0a0a0c] text-white text-xs leading-relaxed shadow-xl animate-fade-in">
          {text}
        </span>
      )}
    </span>
  );
}
