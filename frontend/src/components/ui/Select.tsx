import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Champ "libre" additionnel — permet de taper une valeur absente de la liste (ex: unité personnalisée). */
  allowCustom?: boolean;
  customPlaceholder?: string;
}

// Remplace le <select> natif du navigateur : la partie fermée est déjà
// stylable en CSS, mais la liste déroulante OUVERTE d'un <select> natif est
// dessinée par l'OS et ne peut jamais adopter l'identité visuelle de
// l'app — d'où ce composant, entièrement à nous.
export default function Select({
  value, onChange, options, placeholder = 'Sélectionner...', className = '', disabled, allowCustom, customPlaceholder = 'Autre (préciser)...',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const estValeurLibre = !selected && !!value; // la valeur actuelle ne fait pas partie des options prédéfinies

  const updateCoords = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setCoords({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const onScroll = () => updateCoords();
    const onClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setCustomMode(false);
      }
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open, updateCoords]);

  const handlePick = (v: string) => {
    onChange(v);
    setOpen(false);
    setCustomMode(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customValue.trim()) {
      onChange(customValue.trim());
      setCustomValue('');
      setOpen(false);
      setCustomMode(false);
    }
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`field flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <span className={selected || estValeurLibre ? 'text-[#0a0a0c]' : 'text-gray-400'}>
          {selected ? selected.label : (estValeurLibre ? value : placeholder)}
        </span>
        <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="fs-select-panel"
          style={{ position: 'absolute', top: coords.top, left: coords.left, width: Math.max(coords.width, 200) }}
        >
          {!customMode ? (
            <>
              <div className="max-h-64 overflow-y-auto py-1.5">
                {options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => handlePick(o.value)}
                    className="fs-select-option"
                  >
                    <span>
                      <span className="block">{o.label}</span>
                      {o.sublabel && <span className="block text-xs text-gray-400">{o.sublabel}</span>}
                    </span>
                    {o.value === value && <Check size={15} className="text-[#d9524d] shrink-0" />}
                  </button>
                ))}
                {options.length === 0 && (
                  <p className="px-4 py-3 text-sm text-gray-400">Aucune option</p>
                )}
              </div>
              {allowCustom && (
                <button
                  type="button"
                  onClick={() => setCustomMode(true)}
                  className="fs-select-option border-t border-gray-100 text-[#d9524d] font-medium"
                >
                  + {customPlaceholder}
                </button>
              )}
            </>
          ) : (
            <form onSubmit={handleCustomSubmit} className="p-3">
              <input
                autoFocus
                className="field text-sm"
                placeholder={customPlaceholder}
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setCustomMode(false)} className="btn-ghost text-xs flex-1 justify-center py-1.5">
                  Annuler
                </button>
                <button type="submit" className="btn-primary text-xs flex-1 justify-center py-1.5">
                  Valider
                </button>
              </div>
            </form>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
