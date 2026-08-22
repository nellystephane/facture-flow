import api, { API_BASE_URL } from './axiosConfig';
import type { Invoice, User, Payment, Quote } from '../types';

export interface PublicStats {
  totalUtilisateurs: number;
  totalFactures: number;
  totalEncaisse: number;
  ready: boolean;
}

export const getPublicStats = () => api.get<PublicStats>('/public/stats');

export interface PublicInvoiceResponse {
  invoice: Invoice;
  emetteur: Pick<User, 'nom' | 'entreprise' | 'email' | 'telephone' | 'adresse' | 'devise' | 'banque' | 'logoUrl'>;
  totalTTC: number;
  totalPaye: number;
  payments: Payment[];
}

export const getPublicInvoice = (token: string) =>
  api.get<PublicInvoiceResponse>(`/public/invoices/${token}`);

export const initiateOnlinePayment = (token: string, data: { firstname?: string; lastname?: string; email: string; phone?: string }) =>
  api.post<{ paymentUrl: string }>(`/public/invoices/${token}/pay`, data);

export const getPublicPaymentStatus = (token: string) =>
  api.get<{ statutFacture: string; dernierPaiement: Payment | null }>(`/public/invoices/${token}/statut`);

export const publicReceiptUrl = (token: string, paymentId: string) =>
  `${API_BASE_URL}/public/invoices/${token}/receipt/${paymentId}`;

export interface PublicQuoteResponse {
  quote: Quote;
  emetteur: Pick<User, 'nom' | 'entreprise' | 'email' | 'telephone' | 'adresse' | 'devise' | 'logoUrl'>;
  totalTTC: number;
}

export const getPublicQuote = (token: string) =>
  api.get<PublicQuoteResponse>(`/public/quotes/${token}`);

export const respondPublicQuote = (token: string, data: { action: 'accepter' | 'demander_infos'; message?: string }) =>
  api.post<{ message: string; quote: Quote }>(`/public/quotes/${token}/repondre`, data);
