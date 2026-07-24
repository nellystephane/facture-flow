import api from './axiosConfig';

export interface PublicStats {
  totalUtilisateurs: number;
  totalFactures: number;
  totalEncaisse: number;
  ready: boolean;
}

export const getPublicStats = () => api.get<PublicStats>('/public/stats');
