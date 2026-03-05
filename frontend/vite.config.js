import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const backendHOST = env.VITE_BACKEND_URL || 'http://192.168.1.39:8000'

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: backendHOST,//'http://192.168.1.39:8000', // django_backend  backendHOST,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})