import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';

// Monitoring d'erreurs front — complètement optionnel : sans VITE_SENTRY_DSN
// (non défini par défaut), Sentry.init reste inactif et ne fait rien.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

// Dérivé de BASE_URL (donc toujours aligné avec `base` dans vite.config.ts)
// plutôt qu'une valeur codée en dur qui pourrait un jour désynchroniser les
// deux — voir README, section PWA/déploiement, pour le sous-chemin GitHub Pages.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);

function ErrorFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ fontWeight: 800, fontSize: 18, color: '#0a0a0c' }}>Une erreur inattendue est survenue</p>
      <p style={{ fontSize: 14, color: '#6b7280', maxWidth: 380 }}>
        Essayez de recharger la page. Si le problème persiste, contactez le support.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{ background: 'linear-gradient(135deg,#d9524d,#b23c37)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}
      >
        Recharger
      </button>
    </div>
  );
}