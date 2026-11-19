import api from './axiosConfig';
import type { Paginated } from '../types';

export type ExpenseCategorie =
  | 'loyer' | 'transport' | 'materiel' | 'marketing' | 'salaires'
  | 'fournitures' | 'internet_telephone' | 'taxes' | 'autre';

export type ExpenseMethode = 'especes' | 'mtn_money' | 'moov_money' | 'carte' | 'virement' | 'autre';

export interface Expense {
  _id: string;
  libelle: string;
  montant: number;
  categorie: ExpenseCategorie;
  date: string;
  fournisseur: string;
  methode: ExpenseMethode;
  note: string;
  createdAt: string;
}

export type ExpenseInput = Omit<Expense, '_id' | 'createdAt'>;

export interface ExpensesSummary {
  totalMois: number;
  nombreMois: number;
  totalGlobal: number;
  nombreGlobal: number;
  categoriePrincipaleMois: ExpenseCategorie | null;
}

export const EXPENSE_CATEGORIE_LABEL: Record<ExpenseCategorie, string> = {
  loyer: 'Loyer',
  transport: 'Transport',
  materiel: 'Matériel',
  marketing: 'Marketing',
  salaires: 'Salaires',
  fournitures: 'Fournitures',
  internet_telephone: 'Internet & téléphone',
  taxes: 'Impôts & taxes',
  autre: 'Autre',
};

export const getExpenses = (params?: { page?: number; limit?: number; q?: string; categorie?: string }) =>
  api.get<Paginated<Expense>>('/expenses', { params });
export const getExpensesSummary = () => api.get<ExpensesSummary>('/expenses/summary');
export const createExpense = (data: ExpenseInput) => api.post<Expense>('/expenses', data);
export const updateExpense = (id: string, data: Partial<ExpenseInput>) => api.put<Expense>(`/expenses/${id}`, data);
export const deleteExpense = (id: string) => api.delete(`/expenses/${id}`);
