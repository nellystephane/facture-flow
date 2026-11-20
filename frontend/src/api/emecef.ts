import api from './axiosConfig';

export interface EmecefConfig {
  environment: 'test';
  ifu: string;
  operatorName: string;
  tokenConfigured: boolean;
  lastConnectionCheckAt: string | null;
  lastConnectionStatus: 'unknown' | 'ok' | 'error';
}
export interface EmecefStatus {
  status: string;
  expectedTotal?: number | null;
  dgiTotal?: number | null;
  uid?: string | null;
  codeMECeFDGI?: string | null;
  nim?: string | null;
  dateTime?: string | null;
  qrCode?: string | null;
  counters?: string | null;
  errorCode?: string | null;
  errorDesc?: string | null;
  response?: Record<string, unknown> | null;
}

export const getEmecefConfig = () => api.get<EmecefConfig>('/auth/profile/emecef');
export const saveEmecefConfig = (data: { ifu: string; operatorName: string; token: string }) =>
  api.put<EmecefConfig>('/auth/profile/emecef', data);
export const testEmecefConnection = () => api.post<{ connected: boolean; environment: 'test'; version?: string; tokenValidUntil?: string; nim?: string }>('/auth/profile/emecef/test-connection');
export const prepareEmecefInvoice = (id: string, data: { taxGroup?: string; paymentType: string; priceBasis: 'HT' | 'TTC'; invoiceType: 'FV' | 'FA' | 'EV' | 'EA'; aib?: '' | 'A' | 'B'; reference?: string; autoConfirm?: boolean }) =>
  api.post<{ status: string; uid?: string; response?: Record<string, unknown>; expectedTotal?: number; message?: string }>(`/invoices/${id}/emecef/prepare`, data);
export const confirmEmecefInvoice = (id: string) => api.post<{ status: string; fiscalisation?: EmecefStatus }>(`/invoices/${id}/emecef/confirm`);
export const cancelEmecefInvoice = (id: string) => api.post<{ status: string; fiscalisation?: EmecefStatus }>(`/invoices/${id}/emecef/cancel`);
export const resetEmecefInvoice = (id: string) => api.post<{ status: string; fiscalisation?: EmecefStatus }>(`/invoices/${id}/emecef/reset`, { acknowledge: true });
export const refreshEmecefInvoiceStatus = (id: string) => api.post<{ status: string; pendingOnDgi: boolean; fiscalisation?: EmecefStatus; message?: string }>(`/invoices/${id}/emecef/refresh-status`);

export type EmecefOption = string | { type?: string; code?: string; name?: string; value?: string; description?: string };
export interface EmecefOptions {
  status: { status: boolean; ifu?: string; nim?: string; [key: string]: unknown };
  taxGroups: Record<string, number>;
  invoiceTypes: EmecefOption[];
  paymentTypes: EmecefOption[];
}
export const getEmecefOptions = () => api.get<EmecefOptions>('/invoices/emecef/options');
