import { PALETTE, formatValue } from './chartUtils';
import type { BreakdownResult } from '../../api/analytics';

interface BreakdownChartProps {
  data: BreakdownResult;
  type: 'donut' | 'bars';
}

const R = 70;
const C = 2 * Math.PI * R;

export default function BreakdownChart({ data, type }: BreakdownChartProps) {
  const { items, total, unit } = data;
  if (!items.length || total <= 0) {
    return <p className="text-sm text-gray-400 text-center py-10">Aucune donnée sur cette période</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  let acc = 0;

  return (
    <div className="grid sm:grid-cols-[200px_1fr] gap-6 items-center">
      {type === 'donut' ? (
        <div className="relative mx-auto w-[200px] h-[200px]">
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
            <circle cx="100" cy="100" r={R} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth="26" />
            {items.map((it, i) => {
              const len = (it.value / total) * C;
              const seg = (
                <circle key={it.label} cx="100" cy="100" r={R} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="26"
                  strokeDasharray={`${Math.max(len - 1.5, 0)} ${C - Math.max(len - 1.5, 0)}`} strokeDashoffset={-acc}
                  className="fx-pop" style={{ ['--d' as string]: `${i * 0.08}s`, transformOrigin: '100px 100px' }} />
              );
              acc += len;
              return seg;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</span>
            <span className="text-lg font-extrabold text-[#0a0a0c] dark:text-white tabular-nums">{formatValue(total, unit)}</span>
          </div>
        </div>
      ) : (
        <div className="hidden sm:block" />
      )}

      <ul className={`space-y-3 ${type === 'bars' ? 'sm:col-span-2' : ''}`}>
        {items.map((it, i) => {
          const pct = Math.round((it.value / total) * 100);
          return (
            <li key={it.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0 text-gray-700 dark:text-gray-200">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="truncate">{it.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                  <b className="text-[#0a0a0c] dark:text-white">{formatValue(it.value, unit)}</b> · {pct} %
                </span>
              </div>
              {type === 'bars' && (
                <div className="mt-1.5 h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full fx-grow-x" style={{ width: `${(it.value / max) * 100}%`, background: PALETTE[i % PALETTE.length], ['--d' as string]: `${0.1 + i * 0.08}s` }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
