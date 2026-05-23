import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true, // 0.0.0.0 바인딩
    proxy: {
      '/api': {
        target: process.env.VITE_LANDING_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../frontend/dist",
    emptyOutDir: true,
  },
})
