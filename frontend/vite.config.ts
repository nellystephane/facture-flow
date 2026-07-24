import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  
  // ✅ Base URL pour GitHub Pages
  base: '/facture-flow/', // Mettez le nom de votre repo GitHub
  
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Dev local
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Garder /api
      },
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
  
  // ✅ Configuration pour le build
  build: {
    outDir: 'dist',
    sourcemap: true, // Utile pour le débogage
    minify: 'esbuild',
    
  },
  
  // ✅ Variables d'environnement pour le frontend
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || 'https://facture-flow.onrender.com'
    ),
  },
});