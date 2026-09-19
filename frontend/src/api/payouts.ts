import api from './axiosConfig';

export interface PayoutSettings {
  enabled: boolean;
  mode: 'mobile_money' | 'bank_transfer';
  provider: string;
  phone: string;
  country: string;
  titulaire: string;
  schedule: 'weekly' | 'monthly';
  phoneMasked?: string;
  bank?: string;
  iban?: string;
  rib?: string;
  status?: 'pending' | 'active' | 'disabled';
  emailConfirmed?: boolean;
  confirmedAt?: string | null;
}

export const getPayoutSummary = () => api.get('/payouts/summary');
export const updatePayoutSettings = (data: Partial<PayoutSettings>) => api.put('/payouts/settings', data);
export const resendPayoutConfirmation = () => api.post('/payouts/settings/resend-confirmation');
export const requestPayout = () => api.post('/payouts/request');
export const listPayouts = () => api.get('/payouts');
export const reconcilePayout = (id: string) => api.post(`/payouts/${id}/reconcile`);
