import axios from 'axios';
import { clearAccessToken, getAccessToken, setAccessToken } from './tokenStore';

const baseURL = import.meta.env.VITE_API_URL || 'https://facture-flow.onrender.com/api';
export const API_BASE_URL = baseURL;

let pendingRequests = 0;
let loadingTimer: ReturnType<typeof setTimeout> | null = null;
const emitGlobalLoading = (loading: boolean) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('oryxa:network-loading', { detail: { loading } }));
};
const startGlobalLoading = () => {
  pendingRequests += 1;
  if (pendingRequests !== 1 || loadingTimer) return;
  loadingTimer = setTimeout(() => {
    loadingTimer = null;
    if (pendingRequests > 0) emitGlobalLoading(true);
  }, 350);
};
const stopGlobalLoading = () => {
  pendingRequests = Math.max(0, pendingRequests - 1);
  if (pendingRequests > 0) return;
  if (loadingTimer) { clearTimeout(loadingTimer); loadingTimer = null; }
  emitGlobalLoading(false);
};

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  startGlobalLoading();
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (refreshing && refreshPromise) return refreshPromise;
  refreshing = true;
  refreshPromise = axios.post<{ token: string }>(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
    .then((res) => { setAccessToken(res.data.token); return res.data.token; })
    .catch(() => { clearAccessToken(); return null; })
    .finally(() => { refreshing = false; refreshPromise = null; });
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => { stopGlobalLoading(); return res; },
  async (err) => {
    stopGlobalLoading();
    const original = err.config as any;
    if (err.response?.status === 401 && original && !original.__oryxaRetried && !String(original.url || '').includes('/auth/refresh')) {
      original.__oryxaRetried = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      clearAccessToken();
      const loginPath = `${import.meta.env.BASE_URL}login`.replace(/\/+/g, '/');
      if (!window.location.pathname.includes('/login')) window.location.href = loginPath;
    }
    return Promise.reject(err);
  }
);

export default api;
