import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Проксируем все запросы, начинающиеся с /api, на бэкенд
      '/api': {
        target: 'http://127.0.0.1:8000', // Адрес вашего FastAPI бэкенда
        changeOrigin: true,
      },
    },
  },
})
