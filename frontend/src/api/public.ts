import api from './axiosConfig';
import type { Invoice, User, Payment } from '../types';

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
  `/api/public/invoices/${token}/receipt/${paymentId}`;
