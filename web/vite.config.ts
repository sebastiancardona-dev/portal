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
      // SSO (BFF): the login redirect, OIDC callback and logout all live on the
      // API — proxying them keeps the session cookie same-origin in dev.
      // changeOrigin must stay OFF so Spring sees Host localhost:5173 and builds
      // the OIDC redirect_uri on the SPA origin, not the API's.
      '/oauth2': { target: apiTarget, changeOrigin: false },
      '/login/oauth2': { target: apiTarget, changeOrigin: false },
      '/logout': { target: apiTarget, changeOrigin: false },
    },
  },
})
