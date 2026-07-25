import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  accent?: 'rouge' | 'noir' | 'vert' | 'bleu' | 'orange';
  delay?: number;
}

const ACCENTS: Record<string, string> = {
  rouge: 'linear-gradient(135deg, #d9524d, #b23c37)',
  noir: 'linear-gradient(135deg, #1a1a1f, #0a0a0c)',
  vert: 'linear-gradient(135deg, #10b981, #047857)',
  bleu: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  orange: 'linear-gradient(135deg, #f59e0b, #d97706)',
};

export default function StatCard({ label, value, icon, trend, accent = 'rouge', delay = 0 }: StatCardProps) {
  return (
    <div className="glass-card p-5 animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-extrabold text-[#0a0a0c] mt-1 truncate">{value}</p>
          {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0"
          style={{ background: ACCENTS[accent] }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
