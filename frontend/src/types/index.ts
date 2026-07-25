export interface BankInfo {
  nomBanque?: string;
  titulaire?: string;
  iban?: string;
  rib?: string;
  swift?: string;
}

export interface AbonnementInfo {
  duree: '6mois' | '1an' | null;
  dateDebut?: string | null;
  dateFin?: string | null;
}

export interface User {
  id: string;
  nom: string;
  email: string;
  entreprise?: string;
  telephone?: string;
  adresse?: string;
  logoUrl?: string;
  devise?: string;
  banque?: BankInfo;
  subscription?: 'gratuit' | 'pro' | 'business';
  abonnement?: AbonnementInfo;
  estPremium?: boolean;
}

export interface Client {
  _id: string;
  nom: string;
  entreprise?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  notes?: string;
  owner: string;
  createdAt?: string;
}

export interface Service {
  _id: string;
  nom: string;
  description?: string;
  prix: number;
  unite?: string;
  owner: string;
  createdAt?: string;
}

export interface Item {
  description: string;
  quantite: number;
  prixUnitaire: number;
}

export type InvoiceStatut =
  | 'brouillon' | 'envoyee' | 'vue' | 'payee' | 'en_retard' | 'annulee';

export interface Invoice {
  _id: string;
  numero: string;
  client: Client | string;
  objet?: string;
  dateEmission: string;
  dateEcheance?: string;
  items: Item[];
  remise?: number;
  tva: number;
  notes?: string;
  statut: InvoiceStatut;
  template?: string;
  owner: string;
  quote?: string;
  publicToken?: string;
  dateEnvoi?: string | null;
  dateVue?: string | null;
  totalHT?: number;
  totalTTC?: number;
  createdAt?: string;
}

export type QuoteStatut =
  | 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire';

export interface Quote {
  _id: string;
  numero: string;
  client: Client | string;
  objet?: string;
  dateEmission: string;
  dateExpiration?: string;
  items: Item[];
  remise?: number;
  tva: number;
  notes?: string;
  statut: QuoteStatut;
  owner: string;
  totalHT?: number;
  totalTTC?: number;
  createdAt?: string;
}

export type MethodePaiement =
  | 'especes' | 'mtn_money' | 'moov_money' | 'carte' | 'virement' | 'autre';

export type PaymentOrigine = 'manuel' | 'en_ligne';
export type PaymentStatut = 'en_attente' | 'complete' | 'echoue';

export interface Payment {
  _id: string;
  invoice: Invoice | string;
  montant: number;
  methode: MethodePaiement;
  origine?: PaymentOrigine;
  statut?: PaymentStatut;
  date: string;
  reference?: string;
  note?: string;
  receiptNumber?: string;
  owner: string;
  createdAt?: string;
}

export interface DashboardData {
  totalFactures: number;
  chiffreAffaires: number;
  enAttente: number;
  enRetard: number;
  totalClients: number;
  totalPaye: number;
  revenusMensuels: { mois: string; total: number }[];
  topClients: { nom: string; total: number }[];
  facturesRecentes: Invoice[];
}

export interface SubscriptionOption {
  duree: '6mois' | '1an';
  mois: number;
  prix: number;
}

export interface SubscriptionPlan {
  id: 'pro' | 'business';
  nom: string;
  avantages: string[];
  options: SubscriptionOption[];
}
