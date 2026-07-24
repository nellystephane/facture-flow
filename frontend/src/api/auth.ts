import api from './axiosConfig';
import type { User } from '../types';

export interface RegisterData {
  nom: string;
  email: string;
  password: string;
  entreprise?: string;
}

export const login = (email: string, password: string) =>
  api.post<{ token: string; user: User }>('/auth/login', { email, password });

export const register = (data: RegisterData) =>
  api.post<{ token: string; user: User }>('/auth/register', data);

export const getProfile = () =>
  api.get<User>('/auth/profile');

export const updateProfile = (data: Partial<User>) =>
  api.put<User>('/auth/profile', data);
