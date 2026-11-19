import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}

/** En-tête de page : un titre fort, une ligne de contexte, les actions à droite. */
export default function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7 pb-5 border-b border-gray-200/80 dark:border-white/10 animate-fade-up">
      <div className="flex items-center gap-3.5 min-w-0">
        {icon && (
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#0a0a0c] text-white dark:bg-white dark:text-[#0a0a0c] shrink-0 fx-pop" style={{ ['--d' as string]: '0.15s' }}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl md:text-[1.9rem] leading-tight font-extrabold text-[#0a0a0c] dark:text-white tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
