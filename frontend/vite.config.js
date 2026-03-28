import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // In production, the React app is served by FastAPI from backend/static/
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // In dev, proxy /api calls to the local FastAPI server
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
