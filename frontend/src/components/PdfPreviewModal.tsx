import { useEffect, useState } from 'react';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import Modal from './ui/Modal';
import { apiError } from '../utils/format';
import { useToast } from '../contexts/ToastContext';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string | null;
  filename?: string;
}

export default function PdfPreviewModal({ open, onClose, title, url, filename = 'document.pdf' }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setBlobUrl(null);
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || `Impossible de charger le PDF (${res.status}).`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch((err) => { if (!cancelled) toast(apiError(err), 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, url, toast]);

  const download = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="flex flex-wrap gap-2 mb-4">
        <button className="btn-ghost text-sm" disabled={!blobUrl} onClick={download}><Download size={15} /> Télécharger</button>
        <button className="btn-ghost text-sm" disabled={!blobUrl} onClick={() => blobUrl && window.open(blobUrl, '_blank', 'noopener,noreferrer')}><ExternalLink size={15} /> Nouvel onglet</button>
      </div>
      <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-[#0f0f13] min-h-[60vh] flex items-center justify-center">
        {loading && <Loader2 size={28} className="animate-spin text-[#d9524d]" />}
        {!loading && blobUrl && <iframe title={title} src={blobUrl} className="w-full h-[70vh] bg-white" />}
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Aperçu généré par le même moteur PDF que le document envoyé au client.</p>
    </Modal>
  );
}
