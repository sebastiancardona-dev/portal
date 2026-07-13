import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// dev: API runs on :8080 by default (override with PORTAL_API, e.g. the local
// demo API on :8081); prod: same origin, one container (Spring serves the SPA)
const apiTarget = process.env.PORTAL_API ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiTarget,
    },
  },
})
