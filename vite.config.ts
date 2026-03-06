import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl()
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'lovemtch.shop',
      clientPort: 443,
      protocol: 'wss'
    },
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:4000',
        ws: true,
        secure: false
      },
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
        secure: false
      },
      '/_': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
        secure: false
      },
      '/rooms': {
        target: 'http://127.0.0.1:4000',
        secure: false
      },
      '/stats': {
        target: 'http://127.0.0.1:4000',
        secure: false
      },
      '/admin/stats': {
        target: 'http://127.0.0.1:4000',
        secure: false
      },
      '/admin/login': {
        target: 'http://127.0.0.1:4000',
        secure: false
      },
      '/admin/users': {
        target: 'http://127.0.0.1:4000',
        secure: false
      },
      '/admin/rooms': {
        target: 'http://127.0.0.1:4000',
        secure: false
      },
      '/admin/broadcast': {
        target: 'http://127.0.0.1:4000',
        secure: false
      },
      '/admin/maintenance': {
        target: 'http://127.0.0.1:4000',
        secure: false
      }
    }
  }
})
