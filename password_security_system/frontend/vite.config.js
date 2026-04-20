import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/passwords': 'http://127.0.0.1:8000',
      '/breach': 'http://127.0.0.1:8000',
      '/generator': 'http://127.0.0.1:8000',
      '/alerts': 'http://127.0.0.1:8000',
      '/actions': 'http://127.0.0.1:8000',
      '/score': 'http://127.0.0.1:8000',
      '/export': 'http://127.0.0.1:8000',
      '/audit': 'http://127.0.0.1:8000',
    },
  },
})
