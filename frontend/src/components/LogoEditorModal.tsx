import { useEffect, useRef, useState } from 'react';
import { Check, ImageIcon, Loader2, RotateCcw, ZoomIn } from 'lucide-react';
import Modal from './ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  file: File | null;
  saving?: boolean;
  onSave: (base64: string) => Promise<void> | void;
}

const MAX_OUTPUT_BYTES = 900 * 1024;

export default function LogoEditorModal({ open, onClose, file, saving = false, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    if (!file || !open) return;
    const reader = new FileReader();
    reader.onload = () => setSrc(String(reader.result));
    reader.readAsDataURL(file);
    setZoom(1); setOffset({ x: 0, y: 0 });
  }, [file, open]);

  useEffect(() => {
    if (!src || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = 800 * dpr;
      canvas.height = 400 * dpr;
      canvas.style.aspectRatio = '2 / 1';
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, 800, 400);
      const base = Math.min(760 / img.width, 360 / img.height);
      const w = img.width * base * zoom;
      const h = img.height * base * zoom;
      const x = (800 - w) / 2 + offset.x;
      const y = (400 - h) / 2 + offset.y;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, x, y, w, h);
    };
    img.src = src;
  }, [src, zoom, offset]);

  const pointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    setOffset({ x: dragStart.current.ox + e.clientX - dragStart.current.x, y: dragStart.current.oy + e.clientY - dragStart.current.y });
  };
  const pointerUp = () => setDragging(false);

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let width = 800;
    let height = 400;
    for (let i = 0; i < 5; i += 1) {
      const out = document.createElement('canvas');
      out.width = width; out.height = height;
      const ctx = out.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const previewScale = width / 800;
      ctx.drawImage(canvas, 0, 0, width, height);
      const data = out.toDataURL('image/png');
      if (data.length * 0.75 <= MAX_OUTPUT_BYTES || i === 4) {
        if (data.length * 0.75 > MAX_OUTPUT_BYTES) throw new Error('Le logo reste trop lourd après optimisation. Choisissez une image plus légère.');
        await onSave(data);
        return;
      }
      width = Math.round(width * 0.8); height = Math.round(height * 0.8);
      void previewScale;
    }
  };

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} title="Ajuster votre identité visuelle" size="lg">
      <div className="space-y-5">
        <div className="rounded-2xl p-3 bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%)] dark:bg-none dark:bg-white/5 bg-[length:20px_20px] bg-[position:0_0,10px_10px] border border-gray-200 dark:border-white/10">
          <canvas ref={canvasRef} className="w-full rounded-xl bg-white/70 dark:bg-[#111115] cursor-grab active:cursor-grabbing touch-none" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} />
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111115] p-4 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-3">Aperçu sur document</p>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 bg-white text-[#0f0f13]">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                {src ? <img src={src} alt="Aperçu du logo" className="w-12 h-12 object-contain rounded-lg bg-white border border-gray-100" /> : <div className="w-12 h-12 rounded-lg bg-gray-100" />}
                <div><div className="font-extrabold text-sm truncate">Votre entreprise</div><div className="text-[10px] text-gray-400">Vos coordonnées professionnelles</div></div>
              </div>
              <div className="text-right"><div className="text-[#c9504b] font-extrabold text-sm">FACTURE</div><div className="text-[10px] text-gray-400">N° APERÇU</div></div>
            </div>
            <div className="h-2 bg-gray-100 rounded mt-4 w-2/3" /><div className="h-2 bg-gray-100 rounded mt-2 w-1/2" /><div className="h-2 bg-gray-100 rounded mt-5 w-full" />
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_auto] gap-4 items-center">
          <label className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-3"><ZoomIn size={16} /><span className="shrink-0">Zoom</span><input className="w-full accent-[#d9524d]" type="range" min="0.6" max="2.5" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
          <button className="btn-ghost text-xs" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}><RotateCcw size={14} /> Réinitialiser</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 flex gap-2"><ImageIcon size={15} className="text-[#d9524d] shrink-0" /> Glissez le logo pour le positionner.</div>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3">Le fichier final est optimisé avant envoi et reste compatible avec les PDF Oryxa.</div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-white/10">
          <button className="btn-ghost" disabled={saving} onClick={onClose}>Annuler</button>
          <button className="btn-primary" disabled={saving || !src} onClick={() => save().catch(() => {})}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Enregistrer ce logo</button>
        </div>
      </div>
    </Modal>
  );
}
