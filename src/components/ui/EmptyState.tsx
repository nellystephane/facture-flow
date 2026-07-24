import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="glass-card p-12 text-center animate-scale-in">
      <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-[#e11d2a] bg-[rgba(225,29,42,0.08)] mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-[#0a0a0c]">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
