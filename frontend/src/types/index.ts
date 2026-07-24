export interface User {
  id: string;
  nom: string;
  email: string;
  entreprise?: string;
  telephone?: string;
  adresse?: string;
  logoUrl?: string;
  devise?: string;
  subscription?: 'gratuit' | 'pro' | 'business';
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

export interface Payment {
  _id: string;
  invoice: Invoice | string;
  montant: number;
  methode: MethodePaiement;
  date: string;
  reference?: string;
  note?: string;
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
