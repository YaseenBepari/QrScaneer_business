import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Forward /api/* requests to the Express backend
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
  },
});
