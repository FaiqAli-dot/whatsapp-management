import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = {
  '/api': 'http://127.0.0.1:4000',
  '/health': 'http://127.0.0.1:4000',
  '/ready': 'http://127.0.0.1:4000',
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy,
  },
  preview: {
    port: 4173,
    proxy,
  },
});
