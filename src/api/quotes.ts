import api from './axiosConfig';
import type { Quote, QuoteStatut } from '../types';

export const getQuotes = (params?: { statut?: string }) =>
  api.get<Quote[]>('/quotes', { params });

export const getQuote = (id: string) => api.get<Quote>(`/quotes/${id}`);
export const createQuote = (data: Partial<Quote>) => api.post<Quote>('/quotes', data);
export const updateQuote = (id: string, data: Partial<Quote>) => api.put<Quote>(`/quotes/${id}`, data);
export const patchQuoteStatus = (id: string, statut: QuoteStatut) =>
  api.patch<Quote>(`/quotes/${id}/statut`, { statut });
export const deleteQuote = (id: string) => api.delete(`/quotes/${id}`);

export const quotePdfUrl = (id: string) => `/api/quotes/${id}/pdf`;
