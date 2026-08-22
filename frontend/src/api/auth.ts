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
  api.post<{ token: string; user: User; needsVerification?: boolean; email?: string; emailEnvoye?: boolean; message?: string }>('/auth/register', data);

export const verifyEmail = (email: string, code: string) =>
  api.post<{ token: string; user: User }>('/auth/verifier-email', { email, code });

export const resendVerificationCode = (email: string) =>
  api.post<{ message: string }>('/auth/renvoyer-code', { email });

export const forgotPassword = (email: string) =>
  api.post<{ message: string }>('/auth/mot-de-passe-oublie', { email });

export const resetPassword = (email: string, code: string, password: string) =>
  api.post<{ token: string; user: User; message: string }>('/auth/reinitialiser-mot-de-passe', { email, code, password });

export const getProfile = () =>
  api.get<User>('/auth/profile');

export const updateProfile = (data: Partial<User>) =>
  api.put<User>('/auth/profile', data);

export const uploadLogo = (logoBase64: string) =>
  api.post<User>('/auth/profile/logo', { logoBase64 });

export const removeLogo = () =>
  api.delete<User>('/auth/profile/logo');
