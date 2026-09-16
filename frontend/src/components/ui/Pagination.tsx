import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  page, totalPages, total, onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 mt-6 flex-wrap">
      <p className="text-xs text-gray-400">{total} résultat{total > 1 ? 's' : ''} au total</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="btn-icon disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Page précédente"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-gray-500 font-medium px-2">Page {page} sur {totalPages}</span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-icon disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Page suivante"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
