import type { CSSProperties, ElementType, ReactNode } from 'react';
import { useInView } from '../../hooks/useInView';

interface RevealProps {
  children: ReactNode;
  /** Décalage en millisecondes pour créer une cascade. */
  delay?: number;
  as?: ElementType;
  className?: string;
}

/** Fait entrer son contenu en fondu net quand il apparaît à l'écran. */
export default function Reveal({ children, delay = 0, as: Tag = 'div', className = '' }: RevealProps) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={`fx-reveal ${inView ? 'is-in' : ''} ${className}`.trim()}
      style={{ '--d': `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
