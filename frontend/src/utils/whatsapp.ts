// Partage WhatsApp gratuit (voir docs produit) : pas d'API WhatsApp Business
// payante, on se contente d'ouvrir WhatsApp avec un message prérempli —
// c'est l'utilisateur qui appuie lui-même sur "Envoyer".

// L'app ne gère aujourd'hui que des numéros béninois (voir les opérateurs
// proposés dans Profile.tsx > moyen de retrait), d'où l'indicatif par
// défaut. Si un jour l'app devient multi-pays, brancher ceci sur le champ
// `payoutSettings.country` de l'utilisateur plutôt qu'une valeur fixe.
const INDICATIF_PAR_DEFAUT = '229';

/**
 * Tente de transformer un numéro de téléphone local en numéro international
 * exploitable par wa.me (chiffres uniquement, indicatif inclus).
 * Renvoie null si on ne peut pas déterminer un numéro fiable — dans ce cas
 * l'appelant doit utiliser le lien WhatsApp générique (sans destinataire
 * préciblé), pour ne jamais risquer d'envoyer vers un mauvais numéro.
 */
export function numeroWhatsApp(telephone?: string): string | null {
  if (!telephone) return null;
  const brut = telephone.trim();
  const chiffres = brut.replace(/\D/g, '');
  if (!chiffres) return null;

  // Déjà saisi en format international ("+229...", "00229...")
  if (brut.startsWith('+') || brut.startsWith('00')) {
    return chiffres.replace(/^00/, '');
  }
  // Numéro local béninois classique (8 chiffres, ex: 97 XX XX XX)
  if (chiffres.length === 8) {
    return INDICATIF_PAR_DEFAUT + chiffres;
  }
  // Déjà 11 chiffres et commence par l'indicatif (ex: saisi sans le "+")
  if (chiffres.length === 11 && chiffres.startsWith(INDICATIF_PAR_DEFAUT)) {
    return chiffres;
  }
  // Format non reconnu — on ne devine pas, par sécurité.
  return null;
}

/**
 * Construit l'URL wa.me à ouvrir pour partager un message. Si le numéro du
 * client est exploitable, WhatsApp s'ouvre directement sur sa conversation ;
 * sinon, il s'ouvre sur le sélecteur de contact (l'utilisateur choisit
 * lui-même à qui envoyer).
 */
export function lienPartageWhatsApp(message: string, telephone?: string): string {
  const numero = numeroWhatsApp(telephone);
  const texte = encodeURIComponent(message);
  return numero ? `https://wa.me/${numero}?text=${texte}` : `https://wa.me/?text=${texte}`;
}

export function ouvrirPartageWhatsApp(message: string, telephone?: string) {
  const url = lienPartageWhatsApp(message, telephone);
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia?.('(max-width: 768px)').matches;
  if (mobile) window.location.href = url;
  else window.open(url, '_blank', 'noopener,noreferrer');
}
