import axios from 'axios';
import { API_BASE_URL } from './axiosConfig';
import { clearAdminAccessToken, getAdminAccessToken, setAdminAccessToken } from './adminTokenStore';

const adminApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  withCredentials: true,
});

adminApi.interceptors.request.use((config) => {
  const token = getAdminAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string | null> | null = null;
async function refreshAdminToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = axios.post<{ token: string; email: string }>(`${API_BASE_URL}/admin/refresh`, {}, { withCredentials: true })
    .then((res) => { setAdminAccessToken(res.data.token); return res.data.token; })
    .catch(() => { clearAdminAccessToken(); return null; })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

adminApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as any;
    if ((err.response?.status === 401 || err.response?.status === 403) && original && !original.__oryxaAdminRetried && !String(original.url || '').includes('/admin/refresh')) {
      original.__oryxaAdminRetried = true;
      const token = await refreshAdminToken();
      if (token) {
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return adminApi(original);
      }
      clearAdminAccessToken();
      const loginPath = `${import.meta.env.BASE_URL}admin/login`.replace(/\/+/g, '/');
      if (!window.location.pathname.includes('/admin/login')) window.location.href = loginPath;
    }
    return Promise.reject(err);
  }
);

export default adminApi;
