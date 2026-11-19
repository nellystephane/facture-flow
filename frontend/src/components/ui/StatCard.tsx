import type { ReactNode } from 'react';
import CountUp from './CountUp';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  /** Conservé pour compatibilité : la couleur d'accent ne colore plus que la pastille. */
  accent?: 'rouge' | 'noir' | 'vert' | 'bleu' | 'orange';
  /** « mint » = carte mise en avant (chiffre clé), « dark » = carte sombre, « plain » = neutre. */
  tone?: 'plain' | 'mint' | 'dark';
  delay?: number;
}

const DOT: Record<string, string> = {
  rouge: '#d9524d',
  noir: '#0a0a0c',
  vert: '#10b981',
  bleu: '#3b82f6',
  orange: '#f59e0b',
};

export default function StatCard({ label, value, icon, trend, accent = 'rouge', tone = 'plain', delay = 0 }: StatCardProps) {
  const dark = tone === 'dark';
  const toneClass = tone === 'mint' ? 'stat-tone-mint' : dark ? 'stat-tone-dark' : '';
  return (
    <div className={`glass-card p-5 animate-fade-up ${toneClass}`} style={{ animationDelay: `${delay}s` }}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${dark ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>{label}</p>
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 [&_svg]:w-4 [&_svg]:h-4"
          style={{ background: dark ? 'rgba(255,255,255,0.12)' : `${DOT[accent]}1a`, color: dark ? '#fff' : DOT[accent] }}
        >
          {icon}
        </span>
      </div>
      <p className={`text-[1.75rem] leading-none font-extrabold mt-4 truncate tabular-nums ${dark ? 'text-white' : 'text-[#0a0a0c] dark:text-white'}`}>
        <CountUp value={value} />
      </p>
      {trend && <p className={`text-xs mt-2 ${dark ? 'text-white/50' : 'text-gray-400 dark:text-gray-500'}`}>{trend}</p>}
    </div>
  );
}
