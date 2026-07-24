import api from './axiosConfig';
import type { Invoice, InvoiceStatut } from '../types';

export const getInvoices = (params?: { statut?: string; client?: string }) =>
  api.get<Invoice[]>('/invoices', { params });

export const getInvoice = (id: string) => api.get<Invoice>(`/invoices/${id}`);
export const createInvoice = (data: Partial<Invoice>) => api.post<Invoice>('/invoices', data);
export const updateInvoice = (id: string, data: Partial<Invoice>) => api.put<Invoice>(`/invoices/${id}`, data);
export const patchInvoiceStatus = (id: string, statut: InvoiceStatut) =>
  api.patch<Invoice>(`/invoices/${id}/statut`, { statut });
export const deleteInvoice = (id: string) => api.delete(`/invoices/${id}`);

export const getInvoicePayments = (id: string) =>
  api.get<{ totalPaye: number; paiements: [] }>(`/invoices/${id}/paiements`);

export const createInvoiceFromQuote = (quoteId: string) =>
  api.post<Invoice>(`/invoices/from-quote/${quoteId}`);

// PDF : ouvre dans un nouvel onglet (le backend renvoie le PDF directement)
export const invoicePdfUrl = (id: string) => `/api/invoices/${id}/pdf`;
