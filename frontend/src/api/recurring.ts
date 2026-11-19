import api from './axiosConfig';

export type Frequence = 'hebdomadaire' | 'mensuelle' | 'trimestrielle' | 'annuelle';

export interface RecurringItem {
  description: string;
  quantite: number;
  prixUnitaire: number;
  service?: string | null;
}

export interface Recurring {
  _id: string;
  client: { _id: string; nom: string } | string;
  titre: string;
  objet: string;
  items: RecurringItem[];
  remise: number;
  tva: number;
  devise?: string;
  tauxChange?: number;
  notes: string;
  frequence: Frequence;
  prochaineEmission: string;
  dateFin: string | null;
  delaiEcheanceJours: number;
  envoiAutomatique: boolean;
  actif: boolean;
  nombreGenerees: number;
  derniereGeneration: string | null;
  derniereErreur: string;
}

export interface RecurringInput {
  client: string;
  titre: string;
  objet?: string;
  items: RecurringItem[];
  remise?: number;
  tva?: number;
  devise?: string;
  tauxChange?: number;
  notes?: string;
  frequence: Frequence;
  prochaineEmission: string;
  dateFin?: string | null;
  delaiEcheanceJours: number;
  envoiAutomatique: boolean;
}

export const FREQUENCE_LABEL: Record<Frequence, string> = {
  hebdomadaire: 'Chaque semaine',
  mensuelle: 'Chaque mois',
  trimestrielle: 'Chaque trimestre',
  annuelle: 'Chaque année',
};

export const getRecurring = () => api.get<Recurring[]>('/recurring');
export const createRecurring = (d: RecurringInput) => api.post<Recurring>('/recurring', d);
export const updateRecurring = (id: string, d: Partial<RecurringInput>) => api.put<Recurring>(`/recurring/${id}`, d);
export const setRecurringActif = (id: string, actif: boolean) => api.patch<Recurring>(`/recurring/${id}/actif`, { actif });
export const deleteRecurring = (id: string) => api.delete(`/recurring/${id}`);
