import api, { API_BASE_URL } from './axiosConfig';
import type { Payment, Paginated } from '../types';

export const getPayments = (params?: { invoice?: string; q?: string; page?: number; limit?: number }) =>
  api.get<Paginated<Payment>>('/payments', { params });

export interface PaymentsStats {
  totalEncaisse: number;
  nombrePaiements: number;
  methodePlusFrequente: Payment['methode'] | null;
}
export const getPaymentsStats = () => api.get<PaymentsStats>('/payments/stats');

export const createPayment = (data: Partial<Payment>) =>
  api.post<Payment & { emailEnvoye?: boolean; emailErreur?: string | null }>('/payments', data);

export const deletePayment = (id: string) => api.delete(`/payments/${id}`);

// Reçu PDF téléchargeable (compte connecté)
export const paymentReceiptUrl = (paymentId: string) => `${API_BASE_URL}/payments/${paymentId}/recu`;
