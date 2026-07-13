import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // dev: API runs on :8080; prod: same origin, one container (Spring serves the SPA)
      '/api': 'http://localhost:8080',
    },
  },
})
