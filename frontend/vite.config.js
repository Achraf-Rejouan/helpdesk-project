import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The backend only allows origins 5173 and 3000, so keep the dev server on 5173.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
