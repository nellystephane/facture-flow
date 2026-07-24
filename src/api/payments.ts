import api from './axiosConfig';
import type { Payment } from '../types';

export const getPayments = (params?: { invoice?: string }) =>
  api.get<Payment[]>('/payments', { params });

export const createPayment = (data: Partial<Payment>) => api.post<Payment>('/payments', data);
export const deletePayment = (id: string) => api.delete(`/payments/${id}`);
