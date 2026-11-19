import api from './axiosConfig';
import type { Service } from '../types';

export const getServices = () => api.get<Service[]>('/services');
export const getUnites = () => api.get<{ unites: string[] }>('/services/unites');
export const getService = (id: string) => api.get<Service>(`/services/${id}`);
export const createService = (data: Partial<Service>) => api.post<Service>('/services', data);
export const updateService = (id: string, data: Partial<Service>) => api.put<Service>(`/services/${id}`, data);
export const deleteService = (id: string) => api.delete(`/services/${id}`);

export type MouvementType = 'entree' | 'sortie' | 'ajustement';

export interface StockResume {
  nombreProduits: number;
  valeurAchat: number;
  valeurVente: number;
  enAlerte: { _id: string; nom: string; stock: number; seuilAlerte: number; unite?: string }[];
  epuises: { _id: string; nom: string; stock: number; unite?: string }[];
}

export interface StockMouvement {
  _id: string;
  type: 'entree' | 'sortie' | 'ajustement' | 'facture' | 'annulation';
  quantite: number;
  stockApres: number;
  note: string;
  date: string;
}

export const getStockResume = () => api.get<StockResume>('/services/stock/resume');
export const mouvementStock = (id: string, data: { type: MouvementType; quantite: number; note?: string }) =>
  api.post<Service>(`/services/${id}/stock`, data);
export const getMouvements = (id: string) => api.get<StockMouvement[]>(`/services/${id}/mouvements`);
