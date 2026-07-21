import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered manually in main.tsx, gated on NOT running inside the
      // Capacitor native shell — a service worker inside an embedded
      // WebView fights with the native app's own update mechanism
      // (app store releases) instead of the browser's tab-refresh model.
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'ePay Smart — Zimbabwe Payments',
        short_name: 'ePay Smart',
        description: 'Premium virtual payment platform',
        theme_color: '#4f46e5',
        background_color: '#0f0f1a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // No runtime caching of API responses — this used to target the
        // pre-rebrand api.vpay.app domain (a no-op today since it never
        // matched v-pay-digital-api.vercel.app), but caching financial API
        // responses at all is the wrong default for this app regardless of
        // domain: a stale cached balance/transaction list is worse than a
        // network error.
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@vpay/types': path.resolve(__dirname, '../../packages/types/src'),
      '@vpay/utils': path.resolve(__dirname, '../../packages/utils/src'),
      '@vpay/config': path.resolve(__dirname, '../../packages/config/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4001', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['framer-motion', '@radix-ui/react-dialog', 'lucide-react'],
          charts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
