import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@vpay/types': path.resolve(__dirname, '../../packages/types/src'),
      '@vpay/utils': path.resolve(__dirname, '../../packages/utils/src'),
      '@vpay/config': path.resolve(__dirname, '../../packages/config/src'),
    },
  },
  server: {
    port: 5174,
    proxy: { '/api': { target: 'http://localhost:4001', changeOrigin: true } },
  },
});
