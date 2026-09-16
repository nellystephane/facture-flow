import axios from 'axios';

// En développement, le proxy Vite redirige /api vers le backend local.
// En production, définissez VITE_API_URL (ex: https://api.votredomaine.com/api)
// dans les variables d'environnement de votre hébergeur frontend.
const baseURL = import.meta.env.VITE_API_URL || 'https://facture-flow.onrender.com/api';

// Exporté pour construire des URLs absolues (PDF, reçus...) utilisées avec un
// simple fetch() en dehors de l'instance axios. Indispensable dès que le
// frontend et le backend ne sont PAS sur le même nom de domaine (ex :
// frontend sur GitHub Pages / Vercel et backend sur Render) : une URL
// relative comme "/api/..." se résoudrait alors contre l'origine du
// frontend au lieu du backend, et renverrait une 404.
export const API_BASE_URL = baseURL;

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Injecte le JWT à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Déconnexion auto si token expiré
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      // On respecte le base path de déploiement (ex: "/facture-flow/" sur
      // GitHub Pages) au lieu d'un "/login" absolu qui 404 hors racine.
      const loginPath = `${import.meta.env.BASE_URL}login`.replace(/\/+/g, '/');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(err);
  }
);

export default api;