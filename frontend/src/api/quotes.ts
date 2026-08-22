import api, { API_BASE_URL } from './axiosConfig';
import type { Quote, QuoteStatut, Paginated } from '../types';

export const getQuotes = (params?: { statut?: string; q?: string; page?: number; limit?: number }) =>
  api.get<Paginated<Quote>>('/quotes', { params });

export const getQuote = (id: string) => api.get<Quote>(`/quotes/${id}`);
export const createQuote = (data: Partial<Quote>) => api.post<Quote>('/quotes', data);
export const updateQuote = (id: string, data: Partial<Quote>) => api.put<Quote>(`/quotes/${id}`, data);
export const patchQuoteStatus = (id: string, statut: QuoteStatut) =>
  api.patch<Quote>(`/quotes/${id}/statut`, { statut });
export const deleteQuote = (id: string) => api.delete(`/quotes/${id}`);

export const quotePdfUrl = (id: string) => `${API_BASE_URL}/quotes/${id}/pdf`;
export const sendQuoteEmail = (id: string) =>
  api.post<{ message: string; quote: Quote; quoteUrl?: string }>(`/quotes/${id}/envoyer`);
