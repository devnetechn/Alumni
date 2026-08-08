import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // Allow ngrok subdomains (Vite blocks unknown hosts by default)
    allowedHosts: true,
    proxy: {
      // No changeOrigin: subdomain-based tenant resolution (resolveTenant)
      // reads the original Host header, which changeOrigin would rewrite
      // to match the proxy target instead of the browser's actual host.
      '/api': {
        target: 'http://localhost:4000',
      },
    },
  },
})
