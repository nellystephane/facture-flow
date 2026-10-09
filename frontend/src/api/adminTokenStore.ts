const STORAGE_KEY = 'oryxa_admin_access_token';
let accessToken: string | null = null;

export function setAdminAccessToken(token: string | null) {
  accessToken = token;
  try { if (token) sessionStorage.setItem(STORAGE_KEY, token); else sessionStorage.removeItem(STORAGE_KEY); } catch { /* sessionStorage peut être désactivé */ }
}

export function getAdminAccessToken() {
  if (accessToken) return accessToken;
  try { accessToken = sessionStorage.getItem(STORAGE_KEY); } catch { accessToken = null; }
  return accessToken;
}

export function clearAdminAccessToken() {
  accessToken = null;
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* sessionStorage peut être désactivé */ }
}
