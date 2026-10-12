import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

/** Aide contextuelle positionnée hors des conteneurs qui peuvent la couper. */
export default function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, above: false });
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      if (!anchor.current) return;
      const r = anchor.current.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 24);
      const estimatedHeight = panel.current?.getBoundingClientRect().height || 110;
      const above = window.innerHeight - r.bottom < estimatedHeight + 12 && r.top > estimatedHeight + 12;
      const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
      setPos({ top: above ? Math.max(8, r.top - estimatedHeight - 8) : Math.min(window.innerHeight - estimatedHeight - 8, r.bottom + 8), left, above });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, text]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!anchor.current?.contains(e.target as Node) && !panel.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return <span className="inline-flex align-middle ml-1.5">
    <button ref={anchor} type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label="Aide" className="inline-flex items-center justify-center w-4 h-4 shrink-0 rounded-full bg-[#d9524d]/10 text-[#d9524d] hover:bg-[#d9524d]/20 transition-colors">
      <Info size={11} strokeWidth={2.5} />
    </button>
    {open && createPortal(<span ref={panel} role="tooltip" className="fixed z-[2147483000] block p-3 rounded-xl bg-[#0a0a0c] text-white text-xs leading-relaxed whitespace-normal break-words shadow-2xl" style={{ top: pos.top, left: pos.left, width: 'min(320px, calc(100vw - 24px))', maxHeight: 'min(45vh, 320px)', overflowY: 'auto' }}>
      {text}
    </span>, document.body)}
  </span>;
}
