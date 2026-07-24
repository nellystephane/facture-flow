import type { InvoiceStatut, QuoteStatut, MethodePaiement } from '../types';

/** Formate un montant en FCFA : 1 250 000 FCFA */
export function formatFCFA(n: number | undefined | null): string {
  const value = Number(n || 0);
  return new Intl.NumberFormat('fr-FR').format(Math.round(value)) + ' FCFA';
}

/** Formate un nombre compact : 1,25 M FCFA */
export function formatCompact(n: number | undefined | null): string {
  const value = Number(n || 0);
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace('.0', '') + ' M FCFA';
  if (value >= 1_000) return (value / 1_000).toFixed(0) + ' k FCFA';
  return value + ' FCFA';
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

export function totalTTC(
  items: { quantite: number; prixUnitaire: number }[],
  remise = 0,
  tva = 0
): number {
  return totalHT(items, remise) * (1 + (tva || 0) / 100);
}

// ===== Labels =====
export const INVOICE_STATUT_LABEL: Record<InvoiceStatut, string> = {
  brouillon: 'Brouillon',
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
    if (e?.code === 'ECONNABORTED') {
      return 'Le serveur met trop de temps à répondre. Réessayez.';
    }
    return "Impossible de contacter le serveur. Vérifiez votre connexion internet ou réessayez plus tard.";
  }

  if (e.response.status === 503) {
    return e.response.data?.message || 'Le service est temporairement indisponible. Réessayez dans un instant.';
  }

  return e.response.data?.message || e.message || fallback;
}
