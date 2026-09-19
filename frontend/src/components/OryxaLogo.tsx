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
 * Le logo de marque est distinct du logo personnalisé de l'entreprise cliente.
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
        src={`${import.meta.env.BASE_URL}icons/logo.png`}
        alt="Logo Oryxa"
        width={size}
        height={size}
        className={`object-contain shrink-0 ${imageClassName}`}
        loading="eager"
      />
      {showName && <span className={nameClassName}>Oryxa</span>}
    </span>
  );
}
