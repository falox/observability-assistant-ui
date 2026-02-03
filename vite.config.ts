import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.AGUI_BACKEND_URL || 'http://localhost:9010',
        changeOrigin: true,
      },
    },
  },
})
