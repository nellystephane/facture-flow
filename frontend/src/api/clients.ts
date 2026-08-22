import api from './axiosConfig';
import type { Client, Paginated } from '../types';

export const getClients = (params?: { page?: number; limit?: number; q?: string }) =>
  api.get<Paginated<Client>>('/clients', { params });

// Pour les listes déroulantes (formulaire facture/devis) : un plus grand
// lot en une fois plutôt qu'une pagination, pour garder le choix simple.
// Limite technique de l'API : 100. Au-delà, un sélecteur avec recherche
// serait nécessaire — non couvert par cette pagination basique.
export const getAllClients = () =>
  api.get<Paginated<Client>>('/clients', { params: { limit: 100 } });

export const getClient = (id: string) => api.get<Client>(`/clients/${id}`);
export const createClient = (data: Partial<Client>) => api.post<Client>('/clients', data);
export const updateClient = (id: string, data: Partial<Client>) => api.put<Client>(`/clients/${id}`, data);
export const deleteClient = (id: string) => api.delete(`/clients/${id}`);
