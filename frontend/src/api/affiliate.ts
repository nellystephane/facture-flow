import api from './axiosConfig';

export const getAffiliateMe = () => api.get('/affiliate/me');
export const activateAffiliate = (data?: { telephone?: string; whatsapp?: string }) => api.post('/affiliate/activate', data || {});
export const getAffiliateDashboard = () => api.get('/affiliate/dashboard');
export const getPublicAffiliate = (code: string) => api.get(`/affiliate/public/${encodeURIComponent(code)}`);
