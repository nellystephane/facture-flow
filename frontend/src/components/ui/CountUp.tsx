import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../hooks/useInView';

interface CountUpProps {
  /** Texte ou nombre à afficher, ex. « 85 000 FCFA » ou 12. */
  value: string | number;
  duration?: number;
  className?: string;
}

const NUMBER_RE = /(\d[\d   ]*\d|\d)(?:([.,])(\d+))?/;

function split(text: string) {
  const m = NUMBER_RE.exec(text);
  if (!m) return null;
  const intPart = m[1].replace(/[   ]/g, '');
  const decimals = m[3] || '';
  const target = Number(`${intPart}${decimals ? '.' + decimals : ''}`);
  if (!Number.isFinite(target)) return null;
  return {
    prefix: text.slice(0, m.index),
    suffix: text.slice(m.index + m[0].length),
    target,
    grouped: /[   ]/.test(m[1]),
    sep: m[2] || ',',
    decimalCount: decimals.length,
  };
}

function render(n: number, p: NonNullable<ReturnType<typeof split>>) {
  const fixed = n.toFixed(p.decimalCount);
  const [i, d] = fixed.split('.');
  const intText = p.grouped ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(i)).replace(/[  ]/g, ' ') : i;
  return `${p.prefix}${intText}${d ? p.sep + d : ''}${p.suffix}`;
}

/** Affiche un texte contenant un nombre, qui « monte » jusqu'à sa valeur. */
export default function CountUp({ value, duration = 1100, className }: CountUpProps) {
  const text = String(value);
  const parts = split(text);
  const [shown, setShown] = useState(() => (parts && !prefersReducedMotion() ? render(0, parts) : text));
  const fromRef = useRef(0);

  useEffect(() => {
    const p = split(text);
    if (!p || prefersReducedMotion()) { setShown(text); return; }
    const from = fromRef.current;
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(render(from + (p.target - from) * eased, p));
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = p.target;
    };
    // Petit délai : le compteur démarre quand la carte a fini d'apparaître.
    const timer = window.setTimeout(() => { raf = requestAnimationFrame(step); }, 250);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [text, duration]);

  return <span className={className}>{shown}</span>;
}
