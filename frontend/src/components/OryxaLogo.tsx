import type { CSSProperties } from 'react';

interface OryxaLogoProps {
  size?: number;
  showName?: boolean;
  nameClassName?: string;
  className?: string;
  imageClassName?: string;
  style?: CSSProperties;
}

/**
 * Identité visuelle Oryxa centralisée.
 * Le logo de marque est distinct du logo personnalisé de l’entreprise cliente.
 * Toutes les zones Oryxa passent par ce composant afin de conserver un seul asset officiel.
 */
export default function OryxaLogo({
  size = 40,
  showName = true,
  nameClassName = 'font-extrabold text-xl text-[#0a0a0c] dark:text-white',
  className = '',
  imageClassName = 'rounded-xl',
  style,
}: OryxaLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} style={style}>
      <img
        src={`${import.meta.env.BASE_URL}icons/logo.png?v=20260922-logo-feather`}
        alt="Logo Oryxa"
        width={size}
        height={size}
        className={`oryxa-brand-logo block object-contain object-center shrink-0 aspect-square ${imageClassName}`}
        loading="eager"
      />
      {showName && <span className={nameClassName}>Oryxa</span>}
    </span>
  );
}
