import axios from 'axios';

// En développement, le proxy Vite redirige /api vers le backend local.
// En production, définissez VITE_API_URL (ex: https://api.votredomaine.com/api)
// dans les variables d'environnement de votre hébergeur frontend.
const baseURL = import.meta.env.VITE_API_URL || 'https://facture-flow.onrender.com' ;

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
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
