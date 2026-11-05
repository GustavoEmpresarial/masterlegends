import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      '/stats': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/admin/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/admin/queues': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: { input: { main: path.resolve(__dirname, 'index.html'), sprites: path.resolve(__dirname, 'sprite-preview.html'), gear: path.resolve(__dirname, 'gear-preview.html') } },
    // Source maps em prod expõem src/, node_modules/ etc. no DevTools (e o .map fica público em /assets/*.map)
    sourcemap: process.env.NODE_ENV !== 'production',
  },
});
