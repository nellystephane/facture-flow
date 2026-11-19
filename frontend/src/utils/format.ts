import type { InvoiceStatut, QuoteStatut, MethodePaiement } from '../types';

export const DEVISE_DEFAUT = 'XOF';

export interface DeviseInfo { code: string; label: string; nom: string; decimales: number }

/** Miroir de backend/utils/currency.js. */
export const DEVISES: DeviseInfo[] = [
  { code: 'XOF', label: 'FCFA', nom: 'Franc CFA (XOF)', decimales: 0 },
  { code: 'EUR', label: '€', nom: 'Euro', decimales: 2 },
  { code: 'USD', label: '$', nom: 'Dollar américain', decimales: 2 },
  { code: 'GBP', label: '£', nom: 'Livre sterling', decimales: 2 },
  { code: 'CAD', label: 'CA$', nom: 'Dollar canadien', decimales: 2 },
  { code: 'CHF', label: 'CHF', nom: 'Franc suisse', decimales: 2 },
  { code: 'MAD', label: 'MAD', nom: 'Dirham marocain', decimales: 2 },
  { code: 'NGN', label: '₦', nom: 'Naira nigérian', decimales: 2 },
  { code: 'GHS', label: 'GH₵', nom: 'Cedi ghanéen', decimales: 2 },
  { code: 'GNF', label: 'GNF', nom: 'Franc guinéen', decimales: 0 },
];

/** « FCFA », vide ou inconnu → XOF. */
export function normalizeDevise(d?: string | null): string {
  const v = String(d || '').toUpperCase().replace(/[\s.]/g, '');
  if (!v || v === 'FCFA' || v === 'CFA' || v === 'FRANCCFA') return 'XOF';
  return DEVISES.some((x) => x.code === v) ? v : 'XOF';
}

export function deviseInfo(d?: string | null): DeviseInfo {
  const code = normalizeDevise(d);
  return DEVISES.find((x) => x.code === code) || DEVISES[0];
}

export function deviseCourante(): string { return DEVISE_DEFAUT; }

/** Affichage monétaire : décimales et symbole selon la devise du document (XOF par défaut). */
export function formatMoney(n: number | undefined | null, devise?: string | null): string {
  const info = deviseInfo(devise);
  const value = Number(n || 0);
  const nombre = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: info.decimales, maximumFractionDigits: info.decimales }).format(info.decimales ? value : Math.round(value));
  return `${nombre} ${info.label}`;
}

export function formatFCFA(n: number | undefined | null, devise?: string | null): string { return formatMoney(n, devise); }

/** Montants agrégés (tableaux de bord) : toujours en équivalent FCFA. */
export function formatCompact(n: number | undefined | null, _devise?: string | null): string {
  const value = Number(n || 0);
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace('.0', '') + ' M FCFA';
  if (value >= 1_000) return (value / 1_000).toFixed(0) + ' k FCFA';
  return formatMoney(value);
}

export function formatDate(d?: string | Date): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

export function formatDateLong(d?: string | Date): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ===== Calculs factures / devis =====
export function sousTotal(items: { quantite: number; prixUnitaire: number }[]): number {
  return items.reduce((s, i) => s + (Number(i.quantite) || 0) * (Number(i.prixUnitaire) || 0), 0);
}

export function totalHT(items: { quantite: number; prixUnitaire: number }[], remise = 0): number {
  return Math.max(0, sousTotal(items) - (remise || 0));
}

type TotalItem = { quantite: number; prixUnitaire: number; taxSpecific?: number };
type TotalDocument = { items: TotalItem[]; remise?: number; tva?: number; totalTTC?: number };

export function totalTTC(
  input: TotalItem[] | TotalDocument,
  remise = 0,
  tva = 0
): number {
  // Accepte les lignes seules ou un document facture/devis (plusieurs écrans
  // utilisent les deux formes). Priorité au total calculé par le backend.
  if (!Array.isArray(input)) {
    if (input.totalTTC !== undefined && input.totalTTC !== null && Number.isFinite(Number(input.totalTTC))) return Number(input.totalTTC);
    const items = Array.isArray(input.items) ? input.items : [];
    const specific = items.reduce((sum, item) => sum + (Number(item.taxSpecific) || 0), 0);
    return totalHT(items, Number(input.remise || 0)) * (1 + (Number(input.tva) || 0) / 100) + specific;
  }
  const specific = input.reduce((sum, item) => sum + (Number(item.taxSpecific) || 0), 0);
  return totalHT(input, remise) * (1 + (tva || 0) / 100) + specific;
}

// ===== Labels =====
export const INVOICE_STATUT_LABEL: Record<InvoiceStatut, string> = {
  brouillon: 'En attente d\'envoi',
  envoyee: 'Envoyée',
  vue: 'Vue',
  payee: 'Payée',
  en_retard: 'En retard',
  annulee: 'Annulée',
};

export const QUOTE_STATUT_LABEL: Record<QuoteStatut, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  accepte: 'Accepté',
  refuse: 'Refusé',
  expire: 'Expiré',
};

export const METHODE_LABEL: Record<MethodePaiement, string> = {
  especes: 'Espèces',
  mtn_money: 'MTN Money',
  moov_money: 'Moov Money',
  carte: 'Carte bancaire',
  virement: 'Virement',
  autre: 'Autre',
};

export function badgeClass(statut: string): string {
  return `badge badge-${statut}`;
}

/** Message d'erreur axios lisible */
export function apiError(err: unknown, fallback = 'Une erreur est survenue'): string {
  const e = err as {
    response?: { data?: { message?: string }; status?: number };
    code?: string;
    message?: string;
  };

  // Aucune réponse du serveur : backend injoignable, hors ligne, ou timeout.
  if (!e?.response) {
    if (e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT') {
      return 'Le serveur met trop de temps à répondre. Il peut être en train de se réveiller. Réessayez dans quelques secondes.';
    }
    return "Impossible de contacter le serveur. Vérifiez votre connexion internet ou réessayez plus tard.";
  }

  if (e.response.status === 503) {
    return e.response.data?.message || 'Le service est temporairement indisponible. Réessayez dans un instant.';
  }

  return e.response.data?.message || e.message || fallback;
}

// Construit une URL absolue et partageable vers une page de l'app (lien de
// paiement, lien de devis...), en respectant le sous-chemin de déploiement
// (ex: "/facture-flow/" sur GitHub Pages). Un simple `window.location.origin
// + chemin` produirait un lien cassé hors de ce sous-chemin — voir
// vite.config.ts `base` et main.tsx `basename`, qui doivent rester alignés
// avec import.meta.env.BASE_URL.
export function publicAppUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, ''); // ex: "/facture-flow" ou ""
  return `${window.location.origin}${base}/${path.replace(/^\//, '')}`;
}
