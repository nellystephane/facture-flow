import { API_BASE_URL } from './axiosConfig';
import { clearAccessToken, getAccessToken, setAccessToken } from './tokenStore';

let refreshPromise: Promise<string | null> | null = null;

async function refreshToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).then(async (res) => {
    if (!res.ok) return null;
    const data = await res.json();
    setAccessToken(data.token);
    return data.token as string;
  }).catch(() => null).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const first = await fetch(input, { ...init, credentials: 'include', headers });
  if (first.status !== 401) return first;

  const nextToken = await refreshToken();
  if (!nextToken) {
    clearAccessToken();
    return first;
  }
  headers.set('Authorization', `Bearer ${nextToken}`);
  return fetch(input, { ...init, credentials: 'include', headers });
}
