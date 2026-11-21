import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

export const PDF_TEMPLATES = [
  { id: 'classique', label: 'Classique', desc: 'Sobre et universel, filet rouge Oryxa' },
  { id: 'moderne', label: 'Moderne', desc: 'Bleu net, grille de blocs, nombres en vedette' },
  { id: 'minimal', label: 'Minimal', desc: 'Presque rien : typographie et blanc' },
  { id: 'atelier', label: 'Atelier', desc: 'Papier crème, serif, pointillés' },
  { id: 'horizon', label: 'Horizon', desc: 'Colonne latérale marine avec vos coordonnées' },
  { id: 'prestige', label: 'Prestige', desc: 'Serif et or, cadre fin' },
  { id: 'corporate', label: 'Corporate', desc: 'Tableau quadrillé, total sur bandeau' },
  { id: 'signature', label: 'Signature', desc: 'Bordeaux, italique, montant en grand' },
  { id: 'noir', label: 'Noir', desc: 'Mono, encre pure, bandeau inversé' },
] as const;

export type PdfTemplateId = (typeof PDF_TEMPLATES)[number]['id'];

const INK = '#2a2c33';
const SOFT = '#c9ccd4';

/** Miniatures vectorielles des mises en page (aperçu schématique, pas le rendu réel). */
function Thumb({ id }: { id: string }): ReactNode {
  const lines = (x: number, y: number, n: number, w = 40, c = SOFT, gap = 5) =>
    Array.from({ length: n }, (_, i) => <rect key={i} x={x} y={y + i * gap} width={Math.max(2, w - (i % 3) * 6)} height="1.6" rx=".8" fill={c} />);
  switch (id) {
    case 'classique':
      return <g><rect x="8" y="8" width="18" height="3" fill={INK} /><rect x="8" y="14" width="10" height="1.6" fill="#d9524d" /><rect x="38" y="8" width="14" height="1.6" fill="#d9524d" />{lines(8, 30, 6, 44)}<rect x="30" y="66" width="22" height="2" fill={INK} /></g>;
    case 'moderne':
      return <g><rect x="8" y="8" width="16" height="3" fill={INK} /><rect x="36" y="8" width="16" height="4" fill="#2447d6" /><rect x="8" y="22" width="20" height="10" fill="none" stroke="#2447d6" strokeWidth=".6" /><rect x="32" y="22" width="20" height="10" fill="none" stroke={SOFT} strokeWidth=".6" />{lines(8, 40, 5, 44)}<rect x="34" y="66" width="18" height="4" rx="2" fill="#2447d6" /></g>;
    case 'minimal':
      return <g>{lines(8, 10, 2, 16, INK, 5)}{lines(8, 34, 5, 44, '#e2e3e8', 7)}<rect x="38" y="70" width="14" height="1.6" fill={INK} /></g>;
    case 'atelier':
      return <g><rect width="60" height="80" fill="#faf6ee" /><rect x="8" y="10" width="16" height="3" fill="#26221c" /><rect x="32" y="9" width="20" height="5" fill="#2f5d4b" opacity=".8" />{Array.from({ length: 5 }, (_, i) => <line key={i} x1="8" x2="52" y1={34 + i * 7} y2={34 + i * 7} stroke="#b9ae99" strokeDasharray=".6 2" />)}<line x1="30" x2="52" y1="70" y2="70" stroke="#26221c" /><line x1="30" x2="52" y1="72" y2="72" stroke="#26221c" /></g>;
    case 'horizon':
      return <g><rect x="0" y="0" width="16" height="80" fill="#16283d" /><rect x="3" y="8" width="9" height="2" fill="#fff" opacity=".9" />{lines(3, 40, 4, 10, '#fff', 5).map((e, i) => <g key={i} opacity=".4">{e}</g>)}<rect x="22" y="8" width="20" height="3" fill={INK} />{lines(22, 30, 6, 32)}<rect x="34" y="66" width="18" height="3" fill="#16283d" /></g>;
    case 'prestige':
      return <g><rect width="60" height="80" fill="#fbf8f1" /><rect x="4" y="4" width="52" height="72" fill="none" stroke="#98772a" strokeWidth=".5" /><rect x="22" y="10" width="16" height="3" fill="#2a2620" /><line x1="18" x2="42" y1="18" y2="18" stroke="#98772a" strokeWidth=".6" />{lines(10, 32, 5, 40)}<rect x="30" y="62" width="22" height="9" fill="none" stroke="#98772a" strokeWidth=".6" /></g>;
    case 'corporate':
      return <g><rect x="8" y="8" width="16" height="3" fill="#14284b" /><rect x="8" y="26" width="44" height="6" fill="#14284b" />{Array.from({ length: 4 }, (_, i) => <rect key={i} x="8" y={32 + i * 6} width="44" height="6" fill="none" stroke={SOFT} strokeWidth=".4" />)}<rect x="30" y="62" width="22" height="7" fill="#14284b" /></g>;
    case 'signature':
      return <g><rect x="8" y="9" width="18" height="3" fill="#6e1d3a" opacity=".85" /><rect x="8" y="16" width="12" height="1.6" fill={INK} />{lines(8, 34, 5, 44)}<rect x="30" y="62" width="22" height="7" rx="1" fill="#6e1d3a" opacity=".85" /></g>;
    case 'noir':
      return <g><rect x="8" y="8" width="20" height="4" fill="#0b0b0b" /><rect x="8" y="26" width="44" height="5" fill="#0b0b0b" />{Array.from({ length: 4 }, (_, i) => <line key={i} x1="8" x2="52" y1={38 + i * 6} y2={38 + i * 6} stroke="#0b0b0b" strokeDasharray="1.6 1.6" strokeWidth=".5" />)}<rect x="28" y="62" width="24" height="7" fill="#0b0b0b" /><rect x="30" y="72" width="14" height="1.2" fill="#e8a317" /></g>;
    default:
      return null;
  }
}

/** Miniature autonome d'un modèle (page d'accueil, aperçus). */
export function TemplateThumb({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 60 80" width="100%" height="100%" aria-hidden="true">
      <rect width="60" height="80" fill="#fff" />
      <Thumb id={id} />
    </svg>
  );
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  /** Modèles autorisés par le plan ; si absent, seul « classique » l'est. */
  allowed?: string[];
  lockedLabel?: string;
}

export default function TemplatePicker({ value, onChange, allowed, lockedLabel = 'Plan Pro' }: Props) {
  return (
    <div className="tpl-grid" role="radiogroup" aria-label="Modèle de PDF">
      {PDF_TEMPLATES.map((t) => {
        const ok = allowed ? allowed.includes(t.id) : t.id === 'classique';
        const on = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={!ok}
            onClick={() => ok && onChange(t.id)}
            className={`tpl-card ${on ? 'is-on' : ''}`}
          >
            <span className="tpl-thumb" aria-hidden="true">
              <svg viewBox="0 0 60 80" width="100%" height="100%">
                <rect width="60" height="80" fill="#fff" />
                <Thumb id={t.id} />
              </svg>
              {!ok && <Lock size={13} className="tpl-lock" />}
            </span>
            <span className="tpl-name">{t.label}</span>
            <span className="tpl-desc">{ok ? t.desc : lockedLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
