import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmer', onConfirm, onClose, loading
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-3 items-start mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[rgba(225,29,42,0.12)] text-[#e11d2a] shrink-0">
          <AlertTriangle size={20} />
        </div>
        <p className="text-sm text-gray-600 pt-2">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={loading}>Annuler</button>
        <button className="btn-primary" onClick={onConfirm} disabled={loading}>
          {loading && <span className="spinner" style={{ width: 16, height: 16 }} />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
