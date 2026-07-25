import api from './axiosConfig';
import type { Payment } from '../types';

export const getPayments = (params?: { invoice?: string }) =>
  api.get<Payment[]>('/payments', { params });

export const createPayment = (data: Partial<Payment>) =>
  api.post<Payment & { emailEnvoye?: boolean; emailErreur?: string | null }>('/payments', data);

export const deletePayment = (id: string) => api.delete(`/payments/${id}`);

// Reçu PDF téléchargeable (compte connecté)
export const paymentReceiptUrl = (paymentId: string) => `/api/payments/${paymentId}/recu`;
