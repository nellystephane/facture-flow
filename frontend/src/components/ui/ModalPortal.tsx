import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  onClose: () => void;
  children: ReactNode;
  /** Variante plein écran sur mobile (feuille qui monte du bas). */
  sheet?: boolean;
  label?: string;
  /** Largeur maximale (CSS), 56rem par défaut. */
  width?: string;
}

/**
 * Fond + conteneur de toutes les modales.
 *
 * Rendu dans <body> via un portail : une modale posée dans le contenu d'une
 * page héritait de son contexte d'empilement (z-10, transform d'animation,
 * backdrop-filter) et passait SOUS la barre latérale, qui est en position fixe.
 * Un portail l'en sort pour de bon, quel que soit l'endroit où elle est ouverte.
 */
export default function ModalPortal({ onClose, children, sheet = false, label, width = '56rem' }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={`modal-backdrop fx-modal-backdrop ${sheet ? 'is-sheet' : ''}`} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} className="modal-surface animate-scale-in" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
