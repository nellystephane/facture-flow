import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // On enregistre le service worker nous-mêmes (voir
      // src/components/PwaUpdatePrompt.tsx) pour afficher une bannière
      // "Mettre à jour" au lieu d'un rechargement automatique silencieux.
      injectRegister: false,
      includeAssets: ['icons/favicon-32.png', 'icons/favicon-16.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Oryxa — Facturation & Gestion',
        short_name: 'Oryxa',
        description: "Devis, factures, clients et paiements Mobile Money pour freelances, artisans et PME d'Afrique francophone.",
        lang: 'fr',
        // Chemins relatifs (et non absolus) : indispensable car l'app est
        // servie sous un sous-dossier sur GitHub Pages (voir `base` ci-dessous).
        // Avec des chemins relatifs, le manifeste fonctionne quel que soit
        // l'hébergeur, sans rien à changer ici si vous passez à Vercel/Netlify.
        start_url: '.',
        scope: '.',
        display: 'standalone',
        theme_color: '#db0201',
        background_color: '#0a0a0c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // On ne met en cache que le "shell" de l'app (JS/CSS/HTML/polices/icônes)
        // pour un chargement instantané et un minimum hors-ligne — jamais les
        // réponses de /api : les factures, devis et paiements doivent toujours
        // venir du réseau, pas d'un cache qui pourrait afficher des montants
        // ou des statuts de paiement périmés.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: false, // évite les surprises de cache pendant `npm run dev`
      },
    }),
  ],
  base: '/facture-flow/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});