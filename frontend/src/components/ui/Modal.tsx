import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import ModalPortal from './ModalPortal';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;
  const widths = { sm: '28rem', md: '32rem', lg: '42rem' };
  return (
    <ModalPortal onClose={onClose} label={title} width={widths[size]}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="modal-title">{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </ModalPortal>
  );
}
