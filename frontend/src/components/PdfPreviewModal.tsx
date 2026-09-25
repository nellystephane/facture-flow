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
  const [mobile, setMobile] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMobile(window.matchMedia?.('(max-width: 768px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

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
      <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-[#0f0f13] min-h-[55vh] flex items-center justify-center">
        {loading && <Loader2 size={28} className="animate-spin text-[#d9524d]" />}
        {!loading && blobUrl && !mobile && <iframe title={title} src={blobUrl} className="w-full h-[70vh] bg-white" />}
        {!loading && blobUrl && mobile && (
          <div className="p-6 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white dark:bg-white/10 flex items-center justify-center"><ExternalLink size={24} className="text-[#d9524d]" /></div>
            <p className="font-semibold text-[#0a0a0c] dark:text-white">Aperçu PDF prêt</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Sur mobile, Oryxa ouvre le PDF dans le lecteur natif du téléphone pour éviter les problèmes d’affichage des PDF dans les iframes Android/iOS.</p>
            <button className="btn-primary" onClick={() => window.open(blobUrl, '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /> Ouvrir l’aperçu PDF</button>
          </div>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Aperçu généré par le même moteur PDF que le document envoyé au client.</p>
    </Modal>
  );
}
