import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the FastAPI backend runs on :8000; /api and /ws are proxied to it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/ws': { target: 'ws://127.0.0.1:8000', ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: ['@uiw/react-codemirror', '@codemirror/lang-javascript', '@codemirror/view', '@codemirror/state', '@codemirror/language'],
          react: ['react', 'react-dom', 'react-router', '@tanstack/react-query', 'zustand'],
        },
      },
    },
  },
});
