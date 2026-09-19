import axios from 'axios';
import { API_BASE_URL } from './axiosConfig';

// Instance SÉPARÉE de l'instance utilisateur (voir axiosConfig.ts) : un
// admin plateforme n'est pas un compte User, donc son token ne doit jamais
// se mélanger avec le token utilisateur (ni dans le localStorage, ni dans
// les en-têtes envoyés).
const ADMIN_TOKEN_KEY = 'oryxa_admin_token';

const adminApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      const loginPath = `${import.meta.env.BASE_URL}admin/login`.replace(/\/+/g, '/');
      if (!window.location.pathname.includes('/admin/login')) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(err);
  }
);

export { ADMIN_TOKEN_KEY };
export default adminApi;
