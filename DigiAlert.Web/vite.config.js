import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Permet l'accès depuis le téléphone
    proxy: {
      '/api': {
        target: 'http://localhost:5294', // L'adresse de ton API C#
        changeOrigin: true,
        secure: false
      }
    }
  }
})
