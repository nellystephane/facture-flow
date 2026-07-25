import api from './axiosConfig';
import type { SubscriptionPlan, User } from '../types';

export const getPlans = () => api.get<{ plans: SubscriptionPlan[] }>('/subscription/plans');

export const subscribe = (plan: 'pro' | 'business', duree: '6mois' | '1an') =>
  api.post<{ paymentUrl: string }>('/subscription/subscribe', { plan, duree });

export const getSubscriptionStatus = () => api.get<Pick<User, 'subscription' | 'abonnement'>>('/subscription/statut');
