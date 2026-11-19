import { useRef, useState } from 'react';
import type { GroupBy, SeriesResult } from '../../api/analytics';
import { PALETTE, axisNumber, bucketLabel, bucketLabelLong, formatValue, niceMax } from './chartUtils';

interface SeriesChartProps {
  buckets: string[];
  series: SeriesResult[];
  colors: string[];
  groupBy: GroupBy;
  type: 'line' | 'bar';
}

const W = 720;
const H = 300;
const PL = 56;
const PR = 16;
const PT = 16;
const PB = 34;
const IW = W - PL - PR;
const IH = H - PT - PB;

export default function SeriesChart({ buckets, series, colors, groupBy, type }: SeriesChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement | null>(null);
  const n = buckets.length;
  const all = series.flatMap((s) => s.values);
  const maxV = Math.max(0, ...all);
  const minV = Math.min(0, ...all);
  const hi = niceMax(maxV);
  const lo = minV < 0 ? -niceMax(-minV) : 0;
  const span = hi - lo || 1;
  const y = (v: number) => PT + IH * (1 - (v - lo) / span);
  const x = (i: number) => PL + (n === 1 ? IW / 2 : (IW * i) / (n - 1));
  const groupW = IW / Math.max(n, 1);
  const xBar = (i: number) => PL + groupW * i + groupW / 2;

  const ticks = [0, 1, 2, 3, 4].map((k) => lo + (span * k) / 4);
  const labelEvery = Math.max(1, Math.ceil(n / 8));
  const unit = series[0]?.unit || 'fcfa';
  const empty = all.every((v) => v === 0);

  const moveTo = (clientX: number) => {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    if (type === 'bar') {
      setHover(Math.min(n - 1, Math.max(0, Math.floor((px - PL) / groupW))));
    } else {
      const raw = n === 1 ? 0 : ((px - PL) / IW) * (n - 1);
      setHover(Math.min(n - 1, Math.max(0, Math.round(raw))));
    }
  };

  const hx = hover === null ? 0 : type === 'bar' ? xBar(hover) : x(hover);

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img" aria-label="Graphique">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={t === 0 ? 0.25 : 0.1} />
            <text x={PL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="currentColor" fillOpacity={0.55}>{axisNumber(t)}</text>
          </g>
        ))}

        {buckets.map((b, i) => (i % labelEvery === 0 ? (
          <text key={b} x={type === 'bar' ? xBar(i) : x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity={0.55}>
            {bucketLabel(b, groupBy)}
          </text>
        ) : null))}

        {hover !== null && (
          <line x1={hx} x2={hx} y1={PT} y2={PT + IH} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 4" />
        )}

        {type === 'bar' && series.map((s, si) => {
          const bw = Math.min(34, (groupW * 0.72) / series.length);
          return s.values.map((v, i) => {
            const x0 = xBar(i) - (bw * series.length) / 2 + bw * si;
            const top = Math.min(y(v), y(0));
            const h = Math.max(Math.abs(y(v) - y(0)), v === 0 ? 0 : 2);
            return (
              <rect key={`${s.id}-${i}`} x={x0 + 1} y={top} width={Math.max(bw - 2, 1)} height={h} rx={3}
                fill={colors[si] || PALETTE[si % PALETTE.length]} opacity={hover === null || hover === i ? 1 : 0.45}
                className="fx-grow-y" style={{ transformOrigin: `${x0}px ${y(0)}px`, ['--d' as string]: `${0.1 + i * 0.03}s` }} />
            );
          });
        })}

        {type === 'line' && series.map((s, si) => {
          const color = colors[si] || PALETTE[si % PALETTE.length];
          const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
          return (
            <g key={s.id}>
              {series.length === 1 && n > 1 && (
                <path d={`${d} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={color} opacity={0.08} className="fx-pop" style={{ ['--d' as string]: '0.8s' }} />
              )}
              <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="fx-draw" />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : n > 24 ? 0 : 3} fill="#fff" stroke={color} strokeWidth={2} />
              ))}
            </g>
          );
        })}

        <rect x={PL} y={PT} width={IW} height={IH} fill="transparent" onMouseMove={(e) => moveTo(e.clientX)} onMouseLeave={() => setHover(null)}
          onTouchMove={(e) => { const t = e.touches[0]; if (t) moveTo(t.clientX); }} />
      </svg>

      {empty && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 pointer-events-none">
          Aucune donnée sur cette période
        </p>
      )}

      {hover !== null && !empty && (
        <div
          className="absolute z-10 pointer-events-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1f] shadow-lg px-3 py-2 text-xs"
          style={{ left: `${(hx / W) * 100}%`, top: 0, transform: `translateX(${hx / W > 0.7 ? '-105%' : '8%'})` }}
        >
          <p className="font-semibold text-[#0a0a0c] dark:text-white mb-1">{bucketLabelLong(buckets[hover], groupBy)}</p>
          {series.map((s, si) => (
            <p key={s.id} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: colors[si] || PALETTE[si % PALETTE.length] }} />
              {s.label} : <b>{formatValue(s.values[hover], unit)}</b>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
