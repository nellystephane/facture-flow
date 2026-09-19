import api from './axiosConfig';

export const supportApi = {
  list: () => api.get('/support'),
  create: (data: { sujet: string; categorie: string; message: string }) => api.post('/support', data),
  get: (id: string) => api.get(`/support/${id}`),
  reply: (id: string, message: string) => api.post(`/support/${id}/messages`, { message }),
};
